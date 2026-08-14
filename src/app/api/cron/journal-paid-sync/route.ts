import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepJournalPaid } from '@/lib/journalPaidSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled sweep that reads each live, journal-written deal back from the sales
 * journal and reflects its settlement — when the journal shows Result "OK" with
 * a Date Paid, the deal is marked paid and auto-advanced to Funded. Point a
 * Render Cron Job at this every ~1–2 hours.
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
  running = true;
  void sweepJournalPaid()
    .then((r) => console.log('[cron] journal-paid-sync', r))
    .catch((e) => console.error('[cron] journal-paid-sync failed', e))
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
