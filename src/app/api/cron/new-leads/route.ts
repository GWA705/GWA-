import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepNewLeads } from '@/lib/leadNotify';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled sweep that reads the HD Leads Log sheet and pushes each newly-arrived
 * lead to its dealer's users (those who kept "new lead arrives" on). Deduped via
 * the LeadNotified ledger; the first run silently baselines existing leads. Point
 * a Render Cron Job at this every ~5–15 minutes for prompt lead alerts.
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
  void sweepNewLeads()
    .then((r) => console.log('[cron] new-leads', r))
    .catch((e) => console.error('[cron] new-leads failed', e))
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
