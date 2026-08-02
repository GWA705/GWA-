import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runDealerReminders } from '@/lib/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Guards against overlapping runs on this instance: a slow sweep won't be
// re-entered by the next 15-minute tick while it's still sending.
let running = false;

// Constant-time secret comparison that also avoids leaking length.
function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled endpoint for the escalating dealer "your deal is waiting on you"
 * reminders. Call it from a scheduler (e.g. a Render Cron Job) every ~15–30
 * minutes. Protected by a shared secret.
 *
 * Auth: send the secret in the Authorization header only:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * The engine only sends inside the configured hours (8am–9pm by default), so
 * running the cron all day is fine — off-hours runs simply no-op.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Acknowledge immediately and do the (potentially slow) email/push sending in
  // the background — this server stays alive between requests, so the work
  // continues after the response and the scheduler never hits its timeout.
  if (running) {
    return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });
  }
  running = true;
  void runDealerReminders()
    .catch((e) => console.error('[cron] dealer-reminders failed', e))
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
