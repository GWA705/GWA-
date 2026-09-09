import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendWeeklyFundingReport } from '@/lib/reporting/fundingReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Emails last week's funding report to admins. Schedule it once a week (e.g.
 * Monday morning) via a Render Cron Job with `Authorization: Bearer <CRON_SECRET>`.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendWeeklyFundingReport().catch((e) => {
    console.error('[cron] weekly-funding-report failed', e);
    return null;
  });
  return NextResponse.json(result ?? { ran: false });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
