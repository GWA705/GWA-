import 'server-only';
import { prisma } from '@/lib/db';
import { getOffice, type Office } from './monthly';

/**
 * Salesperson leaderboard — ranks reps by funded volume for one office in a year.
 *
 * IMPORTANT: this is built from PORTAL-SUBMITTED deals only (Application records),
 * because the sales journal has no salesperson field. It therefore reflects deals
 * entered through the portal, not the full journal history — label it as such in
 * the UI. Grows more complete as more deals flow through the portal.
 */

export interface LeaderboardRow {
  name: string;
  deals: number; // non-draft applications
  funded: number; // reached FUNDED
  volume: number; // $ of funded deals (approved/financed/requested)
  avgDeal: number; // volume ÷ funded
  winRatePct: number | null; // funded ÷ deals
}

export interface SalespersonLeaderboard {
  office: Office | null;
  year: number;
  rows: LeaderboardRow[];
  totalDeals: number;
  totalFunded: number;
  totalVolume: number;
}

export async function buildSalespersonLeaderboard(dealerId: string, year: number): Promise<SalespersonLeaderboard> {
  const office = await getOffice(dealerId);
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);

  const apps = await prisma.application.findMany({
    where: {
      dealerId,
      status: { not: 'DRAFT' },
      salespersonName: { not: null },
      OR: [
        { dateOfSale: { gte: start, lte: end } },
        { dateOfSale: null, createdAt: { gte: start, lte: end } },
      ],
    },
    select: {
      salespersonName: true,
      status: true,
      approvedAmount: true,
      financedAmount: true,
      requestedAmount: true,
    },
  });

  const map = new Map<string, LeaderboardRow>();
  for (const a of apps) {
    const name = (a.salespersonName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const r = map.get(key) ?? { name, deals: 0, funded: 0, volume: 0, avgDeal: 0, winRatePct: null };
    r.deals += 1;
    if (a.status === 'FUNDED') {
      r.funded += 1;
      r.volume += Number(a.approvedAmount ?? a.financedAmount ?? a.requestedAmount ?? 0);
    }
    map.set(key, r);
  }

  const rows = Array.from(map.values())
    .map((r) => ({
      ...r,
      avgDeal: r.funded > 0 ? Math.round(r.volume / r.funded) : 0,
      winRatePct: r.deals > 0 ? Math.round((r.funded / r.deals) * 100) : null,
    }))
    .sort((a, b) => b.volume - a.volume || b.funded - a.funded || b.deals - a.deals);

  return {
    office,
    year,
    rows,
    totalDeals: rows.reduce((s, r) => s + r.deals, 0),
    totalFunded: rows.reduce((s, r) => s + r.funded, 0),
    totalVolume: rows.reduce((s, r) => s + r.volume, 0),
  };
}
