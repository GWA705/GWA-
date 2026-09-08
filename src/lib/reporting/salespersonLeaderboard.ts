import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { reportStoreScope, type Office } from './monthly';

/**
 * Salesperson leaderboard — ranks reps by paid volume for one office in a year,
 * from the SALES JOURNAL. The rep comes from the journal's "Dealer's Name" column
 * (the same column journal.ts writes the portal salesperson into), so this covers
 * the full journal history, not just portal-entered deals. Money basis matches the
 * monthly report (OK result, counted by date paid).
 */

export interface LeaderboardRow {
  name: string; // display label (most common original spelling)
  deals: number; // paid-OK deals credited to this rep
  volume: number; // total $ of those deals
  avgDeal: number; // volume ÷ deals
  variants: { name: string; deals: number }[]; // original spellings merged here
}

/**
 * Canonical key for a rep name, so near-duplicates merge into one row:
 *  - case/punctuation/space-insensitive ("Nick F" == "Nick.f" == "nick  f")
 *  - order-insensitive for paired names ("Brynn/Alex" == "Alex/Brynn")
 * Conservative: only collapses obvious variants; distinct names stay separate.
 */
export function repKey(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[._]+/g, ' ') // dots/underscores → space (Nick.f → nick f)
    .replace(/[^a-z0-9/ ]/g, '') // drop other punctuation
    .replace(/\s*\/\s*/g, '/') // tidy around slashes
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.includes('/')) {
    return cleaned.split('/').map((s) => s.trim()).filter(Boolean).sort().join('/');
  }
  return cleaned;
}

export interface SalespersonLeaderboard {
  office: Office | null;
  year: number;
  configured: boolean;
  error?: string;
  rows: LeaderboardRow[];
  totalDeals: number;
  totalVolume: number;
  unspecified: number; // deals with no rep named in the journal
}

export async function buildSalespersonLeaderboard(dealerId: string, year: number): Promise<SalespersonLeaderboard> {
  const scope = await reportStoreScope(dealerId);
  const office = scope.office;
  const cur = await readJournal(year);

  const belongs = (d: ReportDeal) => scope.isAll || (d.storeNumber ? scope.storeSet.has(d.storeNumber) : false);
  const isPaidOk = (d: ReportDeal) => d.result === 'OK' && !!d.datePaid && (d.datePaid as Date).getFullYear() === year;
  const deals = cur.deals.filter((d) => belongs(d) && isPaidOk(d));

  // Group deals under a canonical rep key, tracking each original spelling merged
  // in (so the UI can expand a row and show what was combined).
  const groups = new Map<string, { deals: number; volume: number; variants: Map<string, number> }>();
  let unspecified = 0;
  for (const d of deals) {
    const name = (d.salesperson || '').trim();
    if (!name) { unspecified += 1; continue; }
    const key = repKey(name);
    if (!key) { unspecified += 1; continue; }
    const g = groups.get(key) ?? { deals: 0, volume: 0, variants: new Map<string, number>() };
    g.deals += 1;
    g.volume += d.gross;
    g.variants.set(name, (g.variants.get(name) ?? 0) + 1);
    groups.set(key, g);
  }

  const rows: LeaderboardRow[] = Array.from(groups.values())
    .map((g) => {
      const variants = Array.from(g.variants.entries())
        .map(([name, deals]) => ({ name, deals }))
        .sort((a, b) => b.deals - a.deals || a.name.localeCompare(b.name));
      return {
        name: variants[0]?.name ?? '(unknown)', // most common spelling
        deals: g.deals,
        volume: g.volume,
        avgDeal: g.deals > 0 ? Math.round(g.volume / g.deals) : 0,
        variants,
      };
    })
    .sort((a, b) => b.volume - a.volume || b.deals - a.deals);

  return {
    office,
    year,
    configured: cur.configured,
    error: cur.error,
    rows,
    totalDeals: rows.reduce((s, r) => s + r.deals, 0),
    totalVolume: rows.reduce((s, r) => s + r.volume, 0),
    unspecified,
  };
}
