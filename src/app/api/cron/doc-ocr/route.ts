import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPendingOcr } from '@/lib/ocr';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled OCR of queued scans/photos (Tier 2). Point a scheduler (e.g. a
 * Render Cron Job every ~10–15 min) at this endpoint; it reads a small batch of
 * documents flagged ocrPending and extracts their text.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (running) return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });

  // Fire-and-forget: OCR a batch can take longer than the 30s CloudFront origin
  // timeout, which would 504 the caller (a false cron failure) even though the
  // work keeps running on the server. So kick it off and return immediately; the
  // EB server finishes the batch, and docs stay ocrPending until processed, so
  // nothing is lost. (Same pattern as new-leads / doc-expiry-reminders.)
  running = true;
  void runPendingOcr(5)
    .then((r) => console.log('[cron] doc-ocr', r))
    .catch((e) => console.error('[cron] doc-ocr failed', e))
    .finally(() => {
      running = false;
    });
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
