import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendDealerDigest, periodKeyFor } from '@/lib/reporting/digestSend';
import type { DigestPeriod } from '@/lib/reporting/dealerDigest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled dealer insights digest. Point one cron at
 *   /api/cron/dealer-digest?period=week   (Mondays — prior week)
 * and another at
 *   /api/cron/dealer-digest?period=month  (1st of month — prior month)
 *
 * Sends only to offices with insightsEnabled=true, once per office per period
 * (DigestLog dedupe), to every report user at the office.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const period: DigestPeriod = req.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'week';
  const periodKey = periodKeyFor(period, -1); // the just-finished week/month

  const dealers = await prisma.dealer.findMany({
    where: { insightsEnabled: true, active: true },
    select: { id: true },
  });

  const results: { dealerId: string; sent: number; recipients: number; skipped?: string }[] = [];
  for (const d of dealers) {
    // Dedupe: never send the same office the same period twice.
    const already = await prisma.digestLog.findUnique({ where: { dealerId_periodKey: { dealerId: d.id, periodKey } } });
    if (already) {
      results.push({ dealerId: d.id, sent: 0, recipients: 0, skipped: 'already sent' });
      continue;
    }
    try {
      const r = await sendDealerDigest(d.id, period, { offset: -1 });
      results.push(r);
      if (r.sent > 0) {
        await prisma.digestLog.create({ data: { dealerId: d.id, period, periodKey, recipientCount: r.sent } });
      }
    } catch (e) {
      console.error('[cron] dealer-digest failed for', d.id, e);
      results.push({ dealerId: d.id, sent: 0, recipients: 0, skipped: 'error' });
    }
  }

  const totalSent = results.reduce((s, r) => s + r.sent, 0);
  console.log('[cron] dealer-digest', { period, periodKey, dealers: dealers.length, totalSent });
  return NextResponse.json({ ok: true, period, periodKey, dealers: dealers.length, totalSent, results });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
