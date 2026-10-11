import 'server-only';
import { prisma } from './db';
import type { LeadTextKind } from './leadTextTemplate';

/**
 * Lead auto-text performance: for each message (and overall), how many were sent,
 * how many customers replied, and how many of those leads went on to book. Booking
 * is only tracked for scanned/mail-in leads (we hold their status); online HD-sheet
 * leads count toward reply rate but not booking rate.
 */

const KIND_LABEL: Record<LeadTextKind, string> = {
  CONFIRM: 'Confirmation', DAY1: 'Day-1 reminder', MISSED_WINDOW: 'Missed-window', REACTIVATION: 'Reactivation',
};
const BOOKED_STATUSES = new Set(['BOOKED', 'CONFIRMED', 'SOLD']);

export interface KindStat {
  kind: LeadTextKind;
  label: string;
  sent: number; // raw texts sent of this kind
  leads: number; // distinct leads that received this kind
  replied: number;
  replyRate: number; // replied / leads
  bookable: number; // leads of this kind we can track bookings for (scanned/mail-in)
  booked: number;
  bookRate: number; // booked / bookable
}

export interface RecentReply {
  customerName: string | null;
  kind: LeadTextKind;
  text: string | null;
  at: string;
}

export interface LeadTextPerformance {
  days: number;
  overall: { leads: number; sent: number; replied: number; replyRate: number; bookable: number; booked: number; bookRate: number };
  byKind: KindStat[];
  recentReplies: RecentReply[];
  hasData: boolean;
}

const baseKeyOf = (leadKey: string) => leadKey.replace(/#(d1|mw|re)$/, '');
const scannedIdOf = (baseKey: string) => baseKey.match(/^s:(.+)$/)?.[1] ?? null;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function getLeadTextPerformance(days = 90): Promise<LeadTextPerformance> {
  const since = new Date(Date.now() - Math.max(1, days) * 86_400_000);

  const rows = await prisma.leadTextOutbox.findMany({
    where: { status: 'SENT', sentAt: { gte: since } },
    select: { leadKey: true, kind: true, repliedAt: true, source: true },
  });

  // Group to one record per base lead, tracking which kinds it got + if it replied.
  interface LeadAgg { kinds: Set<LeadTextKind>; replied: boolean; scannedId: string | null }
  const leads = new Map<string, LeadAgg>();
  const sentByKind = new Map<string, number>();
  for (const r of rows) {
    sentByKind.set(r.kind, (sentByKind.get(r.kind) ?? 0) + 1);
    const base = baseKeyOf(r.leadKey);
    let agg = leads.get(base);
    if (!agg) { agg = { kinds: new Set(), replied: false, scannedId: scannedIdOf(base) }; leads.set(base, agg); }
    agg.kinds.add(r.kind as LeadTextKind);
    if (r.repliedAt) agg.replied = true;
  }

  // Which scanned/mail-in leads booked?
  const ids = [...leads.values()].map((a) => a.scannedId).filter((x): x is string => !!x);
  const booked = new Set<string>();
  if (ids.length) {
    const sl = await prisma.scannedLead.findMany({
      where: { id: { in: ids } },
      select: { id: true, bookingRequestedAt: true, bookingStatus: true },
    });
    for (const l of sl) {
      if (l.bookingRequestedAt || (l.bookingStatus && BOOKED_STATUSES.has(l.bookingStatus))) booked.add(l.id);
    }
  }

  const KINDS: LeadTextKind[] = ['CONFIRM', 'DAY1', 'MISSED_WINDOW', 'REACTIVATION'];
  const byKind: KindStat[] = KINDS.map((kind) => {
    let n = 0, replied = 0, bookable = 0, bk = 0;
    for (const a of leads.values()) {
      if (!a.kinds.has(kind)) continue;
      n++;
      if (a.replied) replied++;
      if (a.scannedId) { bookable++; if (booked.has(a.scannedId)) bk++; }
    }
    return {
      kind, label: KIND_LABEL[kind],
      sent: sentByKind.get(kind) ?? 0,
      leads: n, replied, replyRate: pct(replied, n),
      bookable, booked: bk, bookRate: pct(bk, bookable),
    };
  });

  // Overall (distinct leads).
  let oReplied = 0, oBookable = 0, oBooked = 0;
  for (const a of leads.values()) {
    if (a.replied) oReplied++;
    if (a.scannedId) { oBookable++; if (booked.has(a.scannedId)) oBooked++; }
  }
  const overall = {
    leads: leads.size,
    sent: rows.length,
    replied: oReplied, replyRate: pct(oReplied, leads.size),
    bookable: oBookable, booked: oBooked, bookRate: pct(oBooked, oBookable),
  };

  // Recent replies for context.
  const replyRows = await prisma.leadTextOutbox.findMany({
    where: { repliedAt: { not: null, gte: since } },
    orderBy: { repliedAt: 'desc' },
    take: 15,
    select: { customerName: true, kind: true, replyText: true, repliedAt: true },
  });
  const recentReplies: RecentReply[] = replyRows.map((r) => ({
    customerName: r.customerName,
    kind: r.kind as LeadTextKind,
    text: r.replyText,
    at: (r.repliedAt as Date).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  }));

  return { days, overall, byKind, recentReplies, hasData: rows.length > 0 };
}
