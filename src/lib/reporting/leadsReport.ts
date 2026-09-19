import 'server-only';
import { prisma } from '@/lib/db';
import { readLeads, leadKeyOf, type Lead } from '@/lib/leads';
import { readLeadCalls } from '@/lib/leadCalls';
import { weekWindow, monthWindow } from './fundingReport';

/**
 * The Leads report: everything worth knowing about HD leads, grouped by the
 * dealer that owns the store the lead came into. Combines three sources —
 * the HD Leads Log sheet (leads + No-Good flag), the store→dealer mapping, and
 * the portal's call-tracking records (latest outcome per lead) — into one
 * per-dealer breakdown plus a group total.
 */

// The call-activity buckets we report, keyed by a lead's latest logged outcome.
export interface OutcomeCounts {
  notCalled: number;
  na: number; // No answer
  lm: number; // Left message
  spoke: number;
  booked: number;
  sold: number;
  ni: number; // Not interested
}

export interface DealerLeads {
  dealerId: string | null; // null = stores not assigned to any dealer
  dealerName: string;
  total: number;
  noGood: number;
  byKind: { kind: string; count: number }[];
  outcomes: OutcomeCounts;
}

/** One point on the leads trend chart (a week or a month). */
export interface TrendPoint {
  label: string; // e.g. 'Sep 8' (week) or 'Sep 2026' (month)
  total: number; // leads received in the period
  bookedSold: number; // of those, how many booked or sold
}

export interface LeadsReport {
  configured: boolean;
  error?: string;
  generatedAt: string;
  group: {
    total: number;
    noGood: number;
    dealers: number;
    byKind: { kind: string; count: number }[];
    outcomes: OutcomeCounts;
    // Leads by source, so mail-in is visible alongside the HD store leads. The
    // metrics above are the HD (Store) leads from the sheet; `bySource.mailIn`
    // is the count of scanned HD Mail In Test cards in the same window.
    bySource?: { store: number; mailIn: number };
  };
  dealers: DealerLeads[];
  // Lead volume over time, for spotting the effect of HD promotions. Both series
  // cover the last 12 periods ending at generatedAt. `undated` = leads with no
  // readable date (excluded from the trend).
  trend: { week: TrendPoint[]; month: TrendPoint[]; undated: number };
  periodLabel?: string; // set when the report is scoped to a week/month
}

const emptyTrend = (): LeadsReport['trend'] => ({ week: [], month: [], undated: 0 });

/**
 * Resolve a Leads-report period filter from the page's ?p= / ?o= params.
 *  - p='week'|'month' with o = offset (0 = current, -1 = previous, …)
 *  - anything else → all-time (no window).
 */
export function leadsPeriodWindow(period: string | undefined, offset: number): { from?: Date; to?: Date; label?: string } {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  if (period === 'week') {
    const w = weekWindow(offset);
    return { from: w.start, to: w.end, label: `${day(w.start)} – ${day(new Date(w.end.getTime() - 86400000))}` };
  }
  if (period === 'month') {
    const w = monthWindow(offset);
    return { from: w.start, to: w.end, label: w.start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) };
  }
  return {};
}

function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 Sun … 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

/**
 * Bucket leads into the last 12 weeks and last 12 months by dateReceived,
 * counting total leads and how many booked/sold, so the report can chart lead
 * volume (and conversion) over time.
 */
function buildTrend(
  leads: Lead[],
  isBookedSold: (l: Lead) => boolean,
  now: Date,
): LeadsReport['trend'] {
  const N = 12;
  const weekMap = new Map<string, TrendPoint>();
  const weekOrder: string[] = [];
  const curMon = mondayOf(now);
  for (let i = N - 1; i >= 0; i -= 1) {
    const m = new Date(curMon);
    m.setDate(curMon.getDate() - i * 7);
    const key = m.toISOString().slice(0, 10);
    weekOrder.push(key);
    weekMap.set(key, { label: m.toLocaleString('en-US', { month: 'short', day: 'numeric' }), total: 0, bookedSold: 0 });
  }
  const monthMap = new Map<string, TrendPoint>();
  const monthOrder: string[] = [];
  for (let i = N - 1; i >= 0; i -= 1) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    monthOrder.push(key);
    monthMap.set(key, { label: m.toLocaleString('en-US', { month: 'short', year: 'numeric' }), total: 0, bookedSold: 0 });
  }

  let undated = 0;
  for (const l of leads) {
    const d = l.dateReceived;
    if (!d || isNaN(d.getTime())) {
      undated += 1;
      continue;
    }
    const bs = isBookedSold(l);
    const wk = mondayOf(d).toISOString().slice(0, 10);
    const wp = weekMap.get(wk);
    if (wp) {
      wp.total += 1;
      if (bs) wp.bookedSold += 1;
    }
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mp = monthMap.get(mk);
    if (mp) {
      mp.total += 1;
      if (bs) mp.bookedSold += 1;
    }
  }
  return {
    week: weekOrder.map((k) => weekMap.get(k)!),
    month: monthOrder.map((k) => monthMap.get(k)!),
    undated,
  };
}

function emptyOutcomes(): OutcomeCounts {
  return { notCalled: 0, na: 0, lm: 0, spoke: 0, booked: 0, sold: 0, ni: 0 };
}

// The lead's latest meaningful outcome — a plain NOTE isn't an outcome, so we
// look past it to the last real call result.
export function latestOutcome(calls: { outcome: string }[]): keyof OutcomeCounts {
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    switch (calls[i].outcome) {
      case 'NO_ANSWER': return 'na';
      case 'LEFT_MESSAGE': return 'lm';
      case 'SPOKE': return 'spoke';
      case 'BOOKED': return 'booked';
      case 'SOLD': return 'sold';
      case 'NOT_INTERESTED': return 'ni';
      default: break; // NOTE — keep looking back
    }
  }
  return 'notCalled';
}

function kindOf(l: Lead): string {
  return (l.service || '').trim() || 'Unspecified';
}

function topKinds(map: Map<string, number>): { kind: string; count: number }[] {
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

export async function buildLeadsReport(
  generatedAtISO: string,
  opts: { from?: Date; to?: Date; label?: string } = {},
): Promise<LeadsReport> {
  const emptyGroup = { total: 0, noGood: 0, dealers: 0, byKind: [], outcomes: emptyOutcomes() };

  const read = await readLeads();
  if (!read.configured) {
    return { configured: false, generatedAt: generatedAtISO, group: emptyGroup, dealers: [], trend: emptyTrend() };
  }
  if (read.error) {
    return { configured: true, error: read.error, generatedAt: generatedAtISO, group: emptyGroup, dealers: [], trend: emptyTrend() };
  }

  // store number → dealer.
  const stores = await prisma.homeDepotStore.findMany({
    select: { number: true, dealer: { select: { id: true, name: true, profile: { select: { businessName: true } } } } },
  });
  const storeToDealer = new Map<string, { id: string; name: string }>();
  for (const s of stores) {
    const num = s.number.trim();
    if (!num || !s.dealer) continue;
    storeToDealer.set(num, { id: s.dealer.id, name: s.dealer.profile?.businessName || s.dealer.name });
  }

  // The full set drives the trend chart (history); the tiles + per-dealer table
  // scope to the selected period window when one is given.
  const allLeads = read.leads;
  const { from, to } = opts;
  const leads =
    from || to
      ? allLeads.filter((l) => l.dateReceived && (!from || l.dateReceived >= from) && (!to || l.dateReceived < to))
      : allLeads;

  // Latest call outcome per lead key (built over ALL leads so the trend's
  // booked/sold is correct even outside the selected window).
  const keys = Array.from(new Set(allLeads.map(leadKeyOf)));
  const callsByKey = await readLeadCalls(keys);

  // Accumulate per dealer.
  interface Acc {
    dealerId: string | null;
    dealerName: string;
    total: number;
    noGood: number;
    kinds: Map<string, number>;
    outcomes: OutcomeCounts;
  }
  const byDealer = new Map<string, Acc>();
  const groupKinds = new Map<string, number>();
  const groupOutcomes = emptyOutcomes();
  let groupNoGood = 0;

  for (const l of leads) {
    const d = storeToDealer.get((l.storeNumber || '').trim());
    const dealerId = d?.id ?? null;
    const dealerName = d?.name ?? 'Unassigned (unknown store)';
    const bucketKey = dealerId ?? '__unassigned__';
    let acc = byDealer.get(bucketKey);
    if (!acc) {
      acc = { dealerId, dealerName, total: 0, noGood: 0, kinds: new Map(), outcomes: emptyOutcomes() };
      byDealer.set(bucketKey, acc);
    }

    acc.total += 1;
    const kind = kindOf(l);
    acc.kinds.set(kind, (acc.kinds.get(kind) ?? 0) + 1);
    groupKinds.set(kind, (groupKinds.get(kind) ?? 0) + 1);

    if (l.noGood) { acc.noGood += 1; groupNoGood += 1; }

    const bucket = latestOutcome(callsByKey[leadKeyOf(l)] ?? []);
    acc.outcomes[bucket] += 1;
    groupOutcomes[bucket] += 1;
  }

  const dealers: DealerLeads[] = [...byDealer.values()]
    .map((a) => ({
      dealerId: a.dealerId,
      dealerName: a.dealerName,
      total: a.total,
      noGood: a.noGood,
      byKind: topKinds(a.kinds),
      outcomes: a.outcomes,
    }))
    .sort((a, b) => b.total - a.total || a.dealerName.localeCompare(b.dealerName));

  const now = (() => {
    const d = new Date(generatedAtISO);
    return isNaN(d.getTime()) ? new Date() : d;
  })();
  const trend = buildTrend(
    allLeads,
    (l) => {
      const o = latestOutcome(callsByKey[leadKeyOf(l)] ?? []);
      return o === 'booked' || o === 'sold';
    },
    now,
  );

  // Scanned HD Mail In Test cards in the same window (by upload/createdAt), so the
  // report shows mail-in alongside the HD store leads. All offices (staff view).
  const mailInCount = await prisma.scannedLead.count({
    where: from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {},
  });

  return {
    configured: true,
    generatedAt: generatedAtISO,
    group: {
      total: leads.length,
      noGood: groupNoGood,
      dealers: dealers.filter((d) => d.dealerId).length,
      byKind: topKinds(groupKinds),
      outcomes: groupOutcomes,
      bySource: { store: leads.length, mailIn: mailInCount },
    },
    dealers,
    trend,
    periodLabel: opts.label,
  };
}
