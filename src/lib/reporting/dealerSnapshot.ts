import 'server-only';
import { prisma } from '@/lib/db';
import { readJournal, type ReportDeal } from './journalRead';

/**
 * "Dealer Snapshot" — an admin quick-glance, one row per dealer location, of how
 * much they've SOLD and been PAID this month and what's still PENDING (awaiting
 * install). Built for dealer calls: open a dealer, see the three numbers, and
 * drop down the full paid + pending deal lists. Every number and every deal is
 * split into HD (Home Depot program) vs GWA (outside-HD) business.
 *
 *   Sold    = active deals (OK + PE/OK) with a SALE date in the month.
 *   Paid    = OK deals with a DATE PAID in the month (paid receivable).
 *   Pending = PE/OK deals still awaiting install (current state, sold up to the
 *             end of the month), gross > 0 — $0 PE/OK are dead deals, not pending.
 *
 * Attribution to a dealer: HD deals by their HD store number (the reliable key,
 * same as the monthly report); outside-HD deals by matching the journal's
 * location label to a dealer name. Deals that match neither are reported in a
 * separate "unmatched" line so coverage is never silently overstated.
 */

export interface HGSplit {
  hd: number;
  gwa: number;
  total: number;
}

export interface SnapDeal {
  name: string;
  product: string;
  amount: number;
  dateLabel: string; // sale date (pending) or date paid (paid)
  isHD: boolean;
  link: string;
}

export interface DealerSnapRow {
  dealerId: string;
  name: string;
  sold: HGSplit;
  paid: HGSplit;
  pending: HGSplit;
  soldCount: number;
  paidDeals: SnapDeal[];
  pendingDeals: SnapDeal[];
}

export interface DealerSnapshot {
  monthLabel: string;
  ym: string;
  rows: DealerSnapRow[];
  totals: { sold: HGSplit; paid: HGSplit; pending: HGSplit };
  unmatched: { soldCount: number; sold: HGSplit; paid: HGSplit; pending: HGSplit };
  configured: boolean;
  error?: string;
}

const FILLER = new Set([
  'inc', 'ltd', 'llc', 'corp', 'co', 'the', 'and', 'water', 'air', 'services',
  'service', 'home', 'comfort', 'heating', 'cooling', 'hvac', 'mechanical', 'gwa',
  'ghs', 'group', 'ontario', 'canada',
]);

/** Normalize a name to its distinctive word tokens (drops corporate filler). */
export function nameTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !FILLER.has(w));
}

function emptySplit(): HGSplit {
  return { hd: 0, gwa: 0, total: 0 };
}

function addToSplit(s: HGSplit, amt: number, isHD: boolean): void {
  if (isHD) s.hd += amt;
  else s.gwa += amt;
  s.total += amt;
}

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

interface Accum {
  dealerId: string;
  name: string;
  sold: HGSplit;
  paid: HGSplit;
  pending: HGSplit;
  soldCount: number;
  paidDeals: SnapDeal[];
  pendingDeals: SnapDeal[];
}

function newAccum(dealerId: string, name: string): Accum {
  return {
    dealerId,
    name,
    sold: emptySplit(),
    paid: emptySplit(),
    pending: emptySplit(),
    soldCount: 0,
    paidDeals: [],
    pendingDeals: [],
  };
}

/**
 * Build the dealer snapshot for a given month.
 * @param year full year, @param monthIndex 0–11
 */
export async function buildDealerSnapshot(year: number, monthIndex: number): Promise<DealerSnapshot> {
  const dealers = await prisma.dealer.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });

  // Attribution indexes.
  const storeToDealer = new Map<string, string>(); // store number → dealerId
  const tokenToDealer = new Map<string, string>(); // distinctive token → dealerId
  const ambiguousTokens = new Set<string>(); // tokens claimed by 2+ dealers → unusable
  for (const d of dealers) {
    for (const s of d.homeDepotStores) {
      const num = s.number.trim();
      if (num) storeToDealer.set(num, d.id);
    }
    for (const tok of nameTokens(d.name)) {
      const existing = tokenToDealer.get(tok);
      if (existing && existing !== d.id) ambiguousTokens.add(tok);
      else tokenToDealer.set(tok, d.id);
    }
  }

  // Match an outside-HD deal's location label to a dealer by its distinctive
  // tokens. Requires an unambiguous single-dealer match.
  const matchByLocation = (location: string): string | null => {
    const toks = nameTokens(location);
    if (toks.length === 0) return null;
    let hit: string | null = null;
    for (const tok of toks) {
      if (ambiguousTokens.has(tok)) continue;
      const dealerId = tokenToDealer.get(tok);
      if (!dealerId) continue;
      if (hit && hit !== dealerId) return null; // conflicting matches → give up
      hit = dealerId;
    }
    return hit;
  };

  const [cur, prev] = await Promise.all([readJournal(year), readJournal(year - 1)]);
  const configured = cur.configured;
  const error = cur.error || prev.error;
  const allDeals = [...cur.deals, ...prev.deals];

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const inMonth = (d: Date | null) => !!d && d >= monthStart && d <= monthEnd;

  const accums = new Map<string, Accum>();
  for (const d of dealers) accums.set(d.id, newAccum(d.id, d.name));
  const unmatched = newAccum('__unmatched__', 'Unmatched');

  const attribute = (deal: ReportDeal): Accum => {
    let dealerId: string | null = deal.storeNumber ? storeToDealer.get(deal.storeNumber) ?? null : null;
    if (!dealerId) dealerId = matchByLocation(deal.location);
    return (dealerId && accums.get(dealerId)) || unmatched;
  };

  for (const deal of allDeals) {
    if (deal.result === 'RB') continue; // cancelled
    const a = attribute(deal);

    // Sold this month (OK + PE/OK, by sale date).
    if (deal.gross > 0 && inMonth(deal.date)) {
      addToSplit(a.sold, deal.gross, deal.isHD);
      a.soldCount += 1;
    }

    // Paid this month (OK, by date paid).
    if (deal.result === 'OK' && deal.gross > 0 && inMonth(deal.datePaid)) {
      addToSplit(a.paid, deal.gross, deal.isHD);
      a.paidDeals.push({
        name: `${deal.firstName} ${deal.lastName}`.trim() || '(no name)',
        product: deal.product,
        amount: deal.gross,
        dateLabel: fmtDate(deal.datePaid),
        isHD: deal.isHD,
        link: deal.linkUrl,
      });
    }

    // Pending now (PE/OK awaiting install, sold up to month end).
    if (deal.result === 'PE/OK' && deal.gross > 0 && (!deal.date || deal.date <= monthEnd)) {
      addToSplit(a.pending, deal.gross, deal.isHD);
      a.pendingDeals.push({
        name: `${deal.firstName} ${deal.lastName}`.trim() || '(no name)',
        product: deal.product,
        amount: deal.gross,
        dateLabel: fmtDate(deal.date),
        isHD: deal.isHD,
        link: deal.linkUrl,
      });
    }
  }

  const finalize = (a: Accum): DealerSnapRow => ({
    dealerId: a.dealerId,
    name: a.name,
    sold: a.sold,
    paid: a.paid,
    pending: a.pending,
    soldCount: a.soldCount,
    paidDeals: a.paidDeals.sort((x, y) => y.amount - x.amount),
    pendingDeals: a.pendingDeals.sort((x, y) => y.amount - x.amount),
  });

  // Only show dealers with any activity this month, busiest first.
  const rows = Array.from(accums.values())
    .map(finalize)
    .filter((r) => r.sold.total > 0 || r.paid.total > 0 || r.pending.total > 0)
    .sort((x, y) => y.sold.total - x.sold.total || y.pending.total - x.pending.total);

  const totals = { sold: emptySplit(), paid: emptySplit(), pending: emptySplit() };
  for (const r of rows) {
    for (const k of ['sold', 'paid', 'pending'] as const) {
      totals[k].hd += r[k].hd;
      totals[k].gwa += r[k].gwa;
      totals[k].total += r[k].total;
    }
  }

  const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const ym = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  return {
    monthLabel,
    ym,
    rows,
    totals,
    unmatched: {
      soldCount: unmatched.soldCount,
      sold: unmatched.sold,
      paid: unmatched.paid,
      pending: unmatched.pending,
    },
    configured,
    error,
  };
}
