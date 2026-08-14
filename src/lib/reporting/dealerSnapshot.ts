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
  aged?: boolean; // pending only: sold more than 30 days ago
  link: string;
}

export interface DealerSnapRow {
  dealerId: string;
  name: string;
  sold: HGSplit;
  paid: HGSplit;
  pendingRecent: HGSplit; // sold within the last 30 days
  pendingAged: HGSplit; // sold more than 30 days ago (needs chasing)
  soldCount: number;
  paidDeals: SnapDeal[];
  pendingDeals: SnapDeal[];
}

/** One journal "location" label (outside-HD deals) and the dealer it maps to. */
export interface LocationMatch {
  label: string;
  count: number;
  gross: number;
  dealerName: string | null; // null = not matched to any dealer
}

/** An HD store number seen in the journals that isn't assigned to any dealer. */
export interface StoreGap {
  store: string;
  count: number;
  gross: number;
}

export interface DealerSnapshot {
  monthLabel: string;
  ym: string;
  rows: DealerSnapRow[];
  totals: { sold: HGSplit; paid: HGSplit; pendingRecent: HGSplit; pendingAged: HGSplit };
  unmatched: { soldCount: number; sold: HGSplit; paid: HGSplit; pendingRecent: HGSplit; pendingAged: HGSplit };
  // Matching plan: how outside-HD location labels + unmapped HD stores resolve.
  locationMatches: LocationMatch[];
  storeGaps: StoreGap[];
  // Alias rules whose dealer name wasn't found (likely a spelling mismatch).
  unboundAliases: string[];
  configured: boolean;
  error?: string;
}

/**
 * Extra location labels a dealer is known by in the sales journals — city names
 * or trading names that don't contain the dealer's portal name, so the
 * automatic name match can't find them. `dealer` is matched case-insensitively
 * against a dealer's portal name (substring). Add a line here whenever a GWA
 * (outside-HD) location label needs to attribute to a dealer it doesn't share a
 * word with.
 */
const DEALER_ALIASES: { dealer: string; aliases: string[] }[] = [
  // `dealer` is a case-insensitive substring of the dealer's portal name; the
  // shortest reliable fragment is used so small spelling differences still bind.
  { dealer: 'Georgian', aliases: ['Barrie'] },
  { dealer: 'Lakehead', aliases: ['Thunder Bay'] },
  { dealer: 'True North', aliases: ['Sudbury'] },
  { dealer: 'Home Service Providers', aliases: ['London'] },
  { dealer: 'Platinum', aliases: ['Platinum'] },
  { dealer: 'Clean Air and Water', aliases: ['CAWS', 'CAW'] },
  { dealer: 'Oasis', aliases: ['Edmonton', 'Kelowna'] },
  { dealer: 'SIC', aliases: ['Calgary'] },
  { dealer: 'Hydra', aliases: ['Hamilton', 'Brantford'] },
  { dealer: 'Essential', aliases: ['Kingston', 'Ottawa'] },
  { dealer: 'Indig', aliases: ['Winnipeg'] },
];

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
  pendingRecent: HGSplit;
  pendingAged: HGSplit;
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
    pendingRecent: emptySplit(),
    pendingAged: emptySplit(),
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
  const registerToken = (tok: string, dealerId: string) => {
    const existing = tokenToDealer.get(tok);
    if (existing && existing !== dealerId) ambiguousTokens.add(tok);
    else tokenToDealer.set(tok, dealerId);
  };
  for (const d of dealers) {
    for (const s of d.homeDepotStores) {
      const num = s.number.trim();
      if (num) storeToDealer.set(num, d.id);
    }
    for (const tok of nameTokens(d.name)) registerToken(tok, d.id);
  }

  // Explicit alias rules (e.g. Barrie → Georgian, Thunder Bay → Lakehead). These
  // are AUTHORITATIVE — they win over name-token matching — and match on the
  // whole phrase (every alias token must be present) so "Thunder Bay" can't leak
  // into "North Bay". More-specific (multi-word) aliases are checked first.
  const aliasMatchers: { dealerId: string; tokens: string[] }[] = [];
  const unboundAliases: string[] = [];
  for (const entry of DEALER_ALIASES) {
    const needle = entry.dealer.toLowerCase();
    const dealer = dealers.find((d) => d.name.toLowerCase().includes(needle));
    if (!dealer) {
      unboundAliases.push(`${entry.dealer} → ${entry.aliases.join(', ')}`);
      continue;
    }
    for (const alias of entry.aliases) {
      const toks = nameTokens(alias);
      if (toks.length) aliasMatchers.push({ dealerId: dealer.id, tokens: toks });
    }
  }
  aliasMatchers.sort((a, b) => b.tokens.length - a.tokens.length);

  // Match an outside-HD deal's location label to a dealer: explicit aliases
  // first, then an unambiguous distinctive-name-token match.
  const matchByLocation = (location: string): string | null => {
    const toks = nameTokens(location);
    if (toks.length === 0) return null;
    const tokSet = new Set(toks);
    for (const m of aliasMatchers) {
      if (m.tokens.every((t) => tokSet.has(t))) return m.dealerId;
    }
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
  // Pending is a live "as of now" snapshot; aging is measured from today.
  const ageCut = new Date();
  ageCut.setDate(ageCut.getDate() - 30);

  const accums = new Map<string, Accum>();
  for (const d of dealers) accums.set(d.id, newAccum(d.id, d.name));
  const unmatched = newAccum('__unmatched__', 'Unmatched');
  const nameById = new Map(dealers.map((d) => [d.id, d.name] as const));

  // Matching-plan aggregation (across the whole read window, not just the month).
  const locAgg = new Map<string, { count: number; gross: number; dealerId: string | null }>();
  const storeAgg = new Map<string, { count: number; gross: number }>();

  const attribute = (deal: ReportDeal): Accum => {
    let dealerId: string | null = deal.storeNumber ? storeToDealer.get(deal.storeNumber) ?? null : null;
    if (!dealerId) dealerId = matchByLocation(deal.location);
    return (dealerId && accums.get(dealerId)) || unmatched;
  };

  for (const deal of allDeals) {
    if (deal.result === 'RB') continue; // cancelled
    const a = attribute(deal);

    // Feed the matching plan from active deals with real dollars.
    if (deal.gross > 0) {
      if (deal.isHD && deal.storeNumber && !storeToDealer.has(deal.storeNumber)) {
        const e = storeAgg.get(deal.storeNumber) || { count: 0, gross: 0 };
        e.count += 1;
        e.gross += deal.gross;
        storeAgg.set(deal.storeNumber, e);
      } else if (!deal.isHD) {
        const label = (deal.location || '(blank)').trim() || '(blank)';
        const e = locAgg.get(label) || { count: 0, gross: 0, dealerId: matchByLocation(label) };
        e.count += 1;
        e.gross += deal.gross;
        locAgg.set(label, e);
      }
    }

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

    // Pending now (PE/OK awaiting install), split by age: sold in the last 30
    // days vs older than 30 days (the aged ones need chasing). Pending only
    // counts deals sold in the report's own calendar year — older pendings from
    // a prior year are stale/dead and shouldn't inflate the number.
    if (deal.result === 'PE/OK' && deal.gross > 0 && deal.date && deal.date.getFullYear() === year) {
      const aged = deal.date < ageCut;
      addToSplit(aged ? a.pendingAged : a.pendingRecent, deal.gross, deal.isHD);
      a.pendingDeals.push({
        name: `${deal.firstName} ${deal.lastName}`.trim() || '(no name)',
        product: deal.product,
        amount: deal.gross,
        dateLabel: fmtDate(deal.date),
        isHD: deal.isHD,
        aged,
        link: deal.linkUrl,
      });
    }
  }

  const finalize = (a: Accum): DealerSnapRow => ({
    dealerId: a.dealerId,
    name: a.name,
    sold: a.sold,
    paid: a.paid,
    pendingRecent: a.pendingRecent,
    pendingAged: a.pendingAged,
    soldCount: a.soldCount,
    paidDeals: a.paidDeals.sort((x, y) => y.amount - x.amount),
    // Aged pendings first (they need attention), then biggest dollars.
    pendingDeals: a.pendingDeals.sort((x, y) => Number(!!y.aged) - Number(!!x.aged) || y.amount - x.amount),
  });

  const pendingTotal = (r: DealerSnapRow) => r.pendingRecent.total + r.pendingAged.total;

  // Only show dealers with any activity, busiest first.
  const rows = Array.from(accums.values())
    .map(finalize)
    .filter((r) => r.sold.total > 0 || r.paid.total > 0 || pendingTotal(r) > 0)
    .sort((x, y) => y.sold.total - x.sold.total || pendingTotal(y) - pendingTotal(x));

  const totals = { sold: emptySplit(), paid: emptySplit(), pendingRecent: emptySplit(), pendingAged: emptySplit() };
  for (const r of rows) {
    for (const k of ['sold', 'paid', 'pendingRecent', 'pendingAged'] as const) {
      totals[k].hd += r[k].hd;
      totals[k].gwa += r[k].gwa;
      totals[k].total += r[k].total;
    }
  }

  const monthLabel = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const ym = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const locationMatches: LocationMatch[] = Array.from(locAgg.entries())
    .map(([label, v]) => ({ label, count: v.count, gross: v.gross, dealerName: v.dealerId ? nameById.get(v.dealerId) ?? null : null }))
    // Unmatched first, then biggest dollars.
    .sort((a, b) => Number(!!a.dealerName) - Number(!!b.dealerName) || b.gross - a.gross);

  const storeGaps: StoreGap[] = Array.from(storeAgg.entries())
    .map(([store, v]) => ({ store, count: v.count, gross: v.gross }))
    .sort((a, b) => b.gross - a.gross);

  return {
    monthLabel,
    ym,
    rows,
    totals,
    unmatched: {
      soldCount: unmatched.soldCount,
      sold: unmatched.sold,
      paid: unmatched.paid,
      pendingRecent: unmatched.pendingRecent,
      pendingAged: unmatched.pendingAged,
    },
    locationMatches,
    storeGaps,
    unboundAliases,
    configured,
    error,
  };
}
