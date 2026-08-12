import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { getOffice, type Office } from './monthly';

/**
 * Weekly per-store customer detail — the AIRDRIE-style report. For one office
 * and one week, each HD store's confirmed/pending deals listed at the customer
 * level (last name + amount), with per-store totals and an office grand total.
 *
 * Money basis = gross sale, dated by DATE OF SALE, OK + PE/OK (active) deals —
 * matching the weekly cadence.
 */

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function getWeekWindow(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const monday = addDays(d, day === 0 ? -6 : 1 - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = addDays(monday, 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export interface CustomerLine {
  lastName: string;
  product: string;
  amount: number;
  result: 'OK' | 'PE/OK';
  link: string;
}
export interface StoreBlock {
  store: string;
  lines: CustomerLine[];
  total: number;
  count: number;
}
export interface StoreWeekReport {
  office: Office | null;
  weekLabel: string;
  stores: StoreBlock[];
  grandTotal: number;
  grandCount: number;
  configured: boolean;
  error?: string;
}

export async function buildStoreWeekReport(dealerId: string, asOf: Date = new Date()): Promise<StoreWeekReport> {
  const office = await getOffice(dealerId);
  const [cur, prev] = await Promise.all([readJournal(asOf.getFullYear()), readJournal(asOf.getFullYear() - 1)]);
  const allDeals = [...cur.deals, ...prev.deals];

  const week = getWeekWindow(asOf);
  const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

  const storeSet = new Set(office?.storeNumbers ?? []);
  const inWeek = (d: ReportDeal) => !!d.date && d.date >= week.start && d.date <= week.end;
  const active = (d: ReportDeal) => d.result === 'OK' || d.result === 'PE/OK';
  const mine = (d: ReportDeal) => (d.storeNumber ? storeSet.has(d.storeNumber) : false);

  const deals = allDeals.filter((d) => mine(d) && inWeek(d) && active(d));

  const byStore = new Map<string, StoreBlock>();
  for (const s of office?.storeNumbers ?? []) byStore.set(s, { store: s, lines: [], total: 0, count: 0 });
  for (const d of deals) {
    const store = d.storeNumber || d.hdStore || 'Unknown';
    let block = byStore.get(store);
    if (!block) {
      block = { store, lines: [], total: 0, count: 0 };
      byStore.set(store, block);
    }
    block.lines.push({
      lastName: d.lastName || '(no name)',
      product: d.product,
      amount: d.gross,
      result: d.result as 'OK' | 'PE/OK',
      link: d.linkUrl,
    });
    block.total += d.gross;
    block.count += 1;
  }

  const stores = Array.from(byStore.values())
    .filter((b) => b.count > 0) // only stores with activity this week
    .map((b) => ({ ...b, lines: b.lines.sort((a, c) => c.amount - a.amount) }))
    .sort((a, b) => b.total - a.total);

  return {
    office,
    weekLabel: `${fmt(week.start)} – ${fmt(week.end)}`,
    stores,
    grandTotal: stores.reduce((acc, s) => acc + s.total, 0),
    grandCount: stores.reduce((acc, s) => acc + s.count, 0),
    configured: cur.configured,
    error: cur.error || prev.error,
  };
}
