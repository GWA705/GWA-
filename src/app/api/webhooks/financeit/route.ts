import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { verifyWebhook, webhookSecret } from '@/lib/financeit';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024; // 64 KB — webhook payloads are small
const SOURCE = 'financeit';

/**
 * Inbound FinanceIt webhook. Security posture (all in place):
 *  - HMAC signature verification over the RAW body (timing-safe).
 *  - Replay protection via a signed, recent timestamp.
 *  - Idempotency: the provider's event id is unique in WebhookEvent, so a
 *    retried delivery is recorded once and never re-processed.
 *  - Small body cap + per-IP rate limit.
 *
 * The business logic (what each event DOES to a deal) is intentionally a stub:
 * unknown event types are recorded as IGNORED and never mutate a deal. Wire real
 * handlers in `dispatch()` once FinanceIt's event contract is confirmed — see
 * docs/FINANCEIT-API.md.
 */
export async function POST(req: NextRequest) {
  if (!webhookSecret()) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  // Per-IP rate limit + body-size cap (defense before doing any work).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = await rateLimit(`webhook:financeit:${ip}`, 120, 60);
  if (!limit.ok) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const lengthHeader = Number(req.headers.get('content-length') || 0);
  if (lengthHeader && lengthHeader > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // Verify signature + replay window.
  const verdict = verifyWebhook(
    rawBody,
    req.headers.get('x-financeit-signature'),
    req.headers.get('x-financeit-timestamp'),
  );
  if (!verdict.ok) {
    await audit({
      action: 'FINANCEIT_WEBHOOK',
      entityType: 'WebhookEvent',
      detail: `Rejected webhook: ${verdict.reason}`,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Extract the provider's event id + type (field names per FinanceIt's contract;
  // common variants are tried here — confirm and pin the real ones).
  const eventId = String(body.id ?? body.event_id ?? body.eventId ?? '');
  const eventType = (body.type ?? body.event_type ?? body.eventType ?? null) as string | null;
  if (!eventId) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 });
  }

  // Idempotency: the unique [source, eventId] makes a retried delivery a no-op.
  let webhookRowId: string;
  try {
    const row = await prisma.webhookEvent.create({
      data: { source: SOURCE, eventId, eventType: eventType ?? undefined, status: 'RECEIVED' },
    });
    webhookRowId = row.id;
  } catch (e) {
    // Unique-constraint violation → already received; acknowledge without re-processing.
    const code = (e as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error('[financeit] webhook persist failed', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  // Dispatch (safe stub — records outcome, does not mutate deals yet).
  const outcome = await dispatch(eventType, body);
  await prisma.webhookEvent.update({
    where: { id: webhookRowId },
    data: {
      status: outcome.status,
      applicationId: outcome.applicationId ?? null,
      error: outcome.error ?? null,
      processedAt: new Date(),
    },
  });

  await audit({
    action: 'FINANCEIT_WEBHOOK',
    entityType: 'WebhookEvent',
    entityId: webhookRowId,
    detail: `${eventType ?? 'unknown'} → ${outcome.status}`,
  });

  return NextResponse.json({ ok: true });
}

interface DispatchOutcome {
  status: 'PROCESSED' | 'IGNORED' | 'ERROR';
  applicationId?: string | null;
  error?: string;
}

/**
 * Map a FinanceIt event to an action. Until the real event contract is wired,
 * every event is safely recorded and IGNORED (no deal is changed). Add cases
 * here — e.g. approval/decline/funding-status updates — inside a transaction so
 * the state change and the WebhookEvent stay consistent.
 */
async function dispatch(eventType: string | null, _body: Record<string, unknown>): Promise<DispatchOutcome> {
  switch (eventType) {
    // case 'application.approved': ... update the matching deal, return PROCESSED
    // case 'funding.completed':   ...
    default:
      return { status: 'IGNORED' };
  }
}
