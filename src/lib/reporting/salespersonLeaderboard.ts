import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { getOffice, type Office } from './monthly';

/**
 * Salesperson leaderboard — ranks reps by paid volume for one office in a year,
 * from the SALES JOURNAL. The rep comes from the journal's "Dealer's Name" column
 * (the same column journal.ts writes the portal salesperson into), so this covers
 * the full journal history, not just portal-entered deals. Money basis matches the
 * monthly report (OK result, counted by date paid).
 */

export interface LeaderboardRow {
  name: string;
  deals: number; // paid-OK deals credited to this rep
  volume: number; // total $ of those deals
  avgDeal: number; // volume ÷ deals
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
  const office = await getOffice(dealerId);
  const cur = await readJournal(year);

  const storeSet = new Set(office?.storeNumbers ?? []);
  const belongs = (d: ReportDeal) => (d.storeNumber ? storeSet.has(d.storeNumber) : false);
  const isPaidOk = (d: ReportDeal) => d.result === 'OK' && !!d.datePaid && (d.datePaid as Date).getFullYear() === year;
  const deals = cur.deals.filter((d) => belongs(d) && isPaidOk(d));

  const map = new Map<string, LeaderboardRow>();
  let unspecified = 0;
  for (const d of deals) {
    const name = (d.salesperson || '').trim();
    if (!name) { unspecified += 1; continue; }
    const key = name.toLowerCase();
    const r = map.get(key) ?? { name, deals: 0, volume: 0, avgDeal: 0 };
    r.deals += 1;
    r.volume += d.gross;
    map.set(key, r);
  }

  const rows = Array.from(map.values())
    .map((r) => ({ ...r, avgDeal: r.deals > 0 ? Math.round(r.volume / r.deals) : 0 }))
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
