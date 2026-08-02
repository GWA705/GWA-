import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAttentionAlerts } from '@/lib/sla';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Guards against overlapping runs on this instance.
let running = false;

// Constant-time secret comparison that also avoids leaking length.
function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled endpoint for the 2-hour "new deal not looked at" alert. Meant to be
 * called by a scheduler (e.g. a Render Cron Job) every ~15 minutes. Protected by
 * a shared secret so it can't be triggered by the public.
 *
 * Auth: send the secret in the Authorization header only:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * The function itself only sends during business hours (8am–10pm Ontario time),
 * so running the cron all day is fine — off-hours runs simply no-op.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  // Accept the secret only via the Authorization header — never the query string
  // (which would land in access logs, history, and Referer).
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Acknowledge immediately; run the sweep in the background so a slow send
  // never trips the scheduler's request timeout.
  if (running) {
    return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });
  }
  running = true;
  void runAttentionAlerts()
    .catch((e) => console.error('[cron] attention-alerts failed', e))
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
