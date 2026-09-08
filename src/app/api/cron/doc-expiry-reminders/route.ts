import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runDocExpiryReminders } from '@/lib/docReminders';

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
 * Scheduled endpoint for dealer business-document expiry reminders. Call it from
 * a scheduler (Render Cron Job) once a day (or a few times a day). Protected by a
 * shared secret:  Authorization: Bearer <CRON_SECRET>
 *
 * The engine only sends inside the configured hours, so extra runs simply no-op.
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
  void runDocExpiryReminders()
    .catch((e) => console.error('[cron] doc-expiry-reminders failed', e))
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
