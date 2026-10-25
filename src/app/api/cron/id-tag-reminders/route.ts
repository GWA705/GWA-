import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runIdTagReminders } from '@/lib/idTagReminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Guards against overlapping runs on this instance.
let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled endpoint for Home Depot ID-tag expiry reminders (30/15/10/3 days)
 * and the monthly office roster check-up. Call once a day (a few times a day is
 * fine — off-hours and already-sent thresholds simply no-op). Protected by a
 * shared secret:  Authorization: Bearer <CRON_SECRET>
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
  running = true;
  void runIdTagReminders()
    .catch((e) => console.error('[cron] id-tag-reminders failed', e))
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
