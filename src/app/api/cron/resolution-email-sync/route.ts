import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepResolutionEmails } from '@/lib/resolutionEmailSync';
import { gmailResolutionConfigured } from '@/lib/gmailResolution';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled sweep that pulls new replies from each linked HD email thread into
 * its resolution case. Point a scheduler at this every ~30 min (GitHub Actions
 * workflow resolution-email-sync.yml). Inert (returns ok, skipped) until the
 * Gmail integration is configured.
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

  if (!gmailResolutionConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'Gmail resolution sync is not configured' });
  }
  if (running) return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });
  running = true;
  void sweepResolutionEmails()
    .then((r) => console.log('[cron] resolution-email-sync', r))
    .catch((e) => console.error('[cron] resolution-email-sync failed', e))
    .finally(() => { running = false; });
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
