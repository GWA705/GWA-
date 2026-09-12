import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Gift-card report by office (dealer): how many cards were sent and the total $,
 * plus what's still pending. Admin-only. All-time totals. Amounts are the
 * requested/sent card values (Guusto).
 */

export interface GiftCardRow {
  dealerId: string;
  dealer: string;
  sentCount: number;
  sentTotal: number;
  pendingCount: number;
  pendingTotal: number;
  cancelledCount: number;
  lastSentAt: string | null; // ISO date of the most recent card sent
}

export interface GiftCardReport {
  rows: GiftCardRow[];
  totals: { sentCount: number; sentTotal: number; pendingCount: number; pendingTotal: number; cancelledCount: number };
  generatedAt: string;
}

export async function buildGiftCardReport(): Promise<GiftCardReport> {
  const cards = await prisma.giftCardRequest.findMany({
    select: {
      dealerId: true,
      amount: true,
      status: true,
      sentAt: true,
      dealer: { select: { name: true } },
    },
  });

  const byDealer = new Map<string, GiftCardRow>();
  const ensure = (dealerId: string, dealer: string): GiftCardRow => {
    let r = byDealer.get(dealerId);
    if (!r) {
      r = { dealerId, dealer, sentCount: 0, sentTotal: 0, pendingCount: 0, pendingTotal: 0, cancelledCount: 0, lastSentAt: null };
      byDealer.set(dealerId, r);
    }
    return r;
  };

  for (const c of cards) {
    const row = ensure(c.dealerId, c.dealer?.name ?? '(unknown office)');
    const amt = Number(c.amount) || 0;
    if (c.status === 'SENT') {
      row.sentCount += 1;
      row.sentTotal += amt;
      if (c.sentAt && (!row.lastSentAt || c.sentAt.toISOString() > row.lastSentAt)) {
        row.lastSentAt = c.sentAt.toISOString();
      }
    } else if (c.status === 'PENDING') {
      row.pendingCount += 1;
      row.pendingTotal += amt;
    } else if (c.status === 'CANCELLED') {
      row.cancelledCount += 1;
    }
  }

  const rows = Array.from(byDealer.values()).sort((a, b) => b.sentTotal - a.sentTotal);
  const totals = rows.reduce(
    (acc, r) => ({
      sentCount: acc.sentCount + r.sentCount,
      sentTotal: acc.sentTotal + r.sentTotal,
      pendingCount: acc.pendingCount + r.pendingCount,
      pendingTotal: acc.pendingTotal + r.pendingTotal,
      cancelledCount: acc.cancelledCount + r.cancelledCount,
    }),
    { sentCount: 0, sentTotal: 0, pendingCount: 0, pendingTotal: 0, cancelledCount: 0 },
  );

  return { rows, totals, generatedAt: new Date().toISOString() };
}
