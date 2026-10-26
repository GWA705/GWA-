import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { lastFullWeek, weeklyReportsEnabled, sendWeeklyReports, sendAttributionReminder } from '@/lib/reporting/weeklyReports';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Weekly HD reports cron.
 *   ?mode=send   → send the week's reports (national + each store), ONLY if the
 *                  master switch is on. Idempotent per week (sent-log).
 *   ?mode=remind → email staff if any 701 store leads still need an associate.
 * Driven by GitHub Actions (weekly-reports.yml): remind Monday, send Tuesday.
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mode = req.nextUrl.searchParams.get('mode') === 'remind' ? 'remind' : 'send';
  const week = lastFullWeek();

  if (mode === 'remind') {
    const r = await sendAttributionReminder(week).catch((e) => ({ needing: -1, sent: false, error: String(e) }));
    console.log('[cron] weekly-reports remind', JSON.stringify(r));
    return NextResponse.json({ ok: true, mode, ...r });
  }

  // send
  if (!(await weeklyReportsEnabled())) return NextResponse.json({ ok: true, mode, skipped: 'weekly auto-send is OFF' });
  if (running) return NextResponse.json({ ok: true, mode, skipped: 'a run is already in progress' });
  running = true;
  void sendWeeklyReports(week)
    .then((s) => console.log('[cron] weekly-reports send', JSON.stringify(s)))
    .catch((e) => console.error('[cron] weekly-reports send failed', e))
    .finally(() => { running = false; });
  return NextResponse.json({ ok: true, mode, started: true, week: week.label });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
