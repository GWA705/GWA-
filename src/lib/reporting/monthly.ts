import 'server-only';
import { prisma } from '@/lib/db';
import { readJournal, type ReportDeal } from './journalRead';

/**
 * Per-office "Monthly Performance Report" — the format from the office's HD
 * Location Reports v8.0. One office (a portal dealer), broken down by its HD
 * stores, with Month-over-Month, vs-Last-Year and Year-to-Date comparisons and
 * a PE/OK pending-installation block.
 *
 * Money basis here = OK money dated by DATE PAID (paid receivable), which is the
 * office-report convention — distinct from the weekly snapshot's gross-by-sale.
 */

export interface Office {
  dealerId: string;
  name: string;
  storeNumbers: string[];
}

export interface StoreRow {
  store: string;
  prevMonth: number;
  curMonth: number;
  momPct: number | null;
  lyMonth: number;
  yoyPct: number | null; // null = "New" (no LY)
  ytdTy: number;
  ytdLy: number;
  ytdPct: number | null; // null = "New"
}

export interface OfficeMonthlyReport {
  office: Office | null;
  monthLabel: string;
  year: number;
  monthIndex: number;
  stores: StoreRow[];
  total: StoreRow;
  pending: { store: string; amount: number; count: number }[];
  pendingTotal: number;
  ytd: { ty: number; ly: number; pct: number | null; gap: number };
  deadStores: string[];
  configured: boolean;
  error?: string;
}

function pct(cur: number, base: number): number | null {
  if (base <= 0) return cur > 0 ? null : 0; // null → "New"
  return Math.round(((cur - base) / base) * 100);
}

/** Offices that can appear in a monthly report: portal dealers with HD stores. */
export async function listReportOffices(): Promise<Office[]> {
  const dealers = await prisma.dealer.findMany({
    where: { homeDepotStores: { some: {} } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  return dealers.map((d) => ({
    dealerId: d.id,
    name: d.name,
    storeNumbers: Array.from(new Set(d.homeDepotStores.map((s) => s.number.trim()).filter(Boolean))),
  }));
}

export async function getOffice(dealerId: string): Promise<Office | null> {
  const d = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { id: true, name: true, homeDepotStores: { select: { number: true } } },
  });
  if (!d) return null;
  return {
    dealerId: d.id,
    name: d.name,
    storeNumbers: Array.from(new Set(d.homeDepotStores.map((s) => s.number.trim()).filter(Boolean))),
  };
}

/**
 * Build the monthly report for one office.
 * @param dealerId the office (portal dealer)
 * @param year/monthIndex the reporting month (monthIndex 0–11)
 */
export async function buildOfficeMonthlyReport(
  dealerId: string,
  year: number,
  monthIndex: number,
): Promise<OfficeMonthlyReport> {
  const office = await getOffice(dealerId);

  const [cur, prev] = await Promise.all([readJournal(year), readJournal(year - 1)]);
  const configured = cur.configured;
  const error = cur.error || prev.error;
  const allDeals = [...cur.deals, ...prev.deals];

  const monthLabel = new Date(year, monthIndex, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const storeSet = new Set((office?.storeNumbers ?? []).map((s) => s));
  const belongsToOffice = (d: ReportDeal) => (d.storeNumber ? storeSet.has(d.storeNumber) : false);

  // Date-Paid windows.
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(year, monthIndex - 1, 1);
  const prevEnd = new Date(year, monthIndex, 0, 23, 59, 59, 999);
  const lyStart = new Date(year - 1, monthIndex, 1);
  const lyEnd = new Date(year - 1, monthIndex + 1, 0, 23, 59, 59, 999);
  const ytdStart = new Date(year, 0, 1);
  const lyYtdStart = new Date(year - 1, 0, 1);

  const inRange = (d: Date | null, a: Date, b: Date) => !!d && d >= a && d <= b;
  const isPaidOk = (d: ReportDeal) => d.result === 'OK' && !!d.datePaid;

  const officeDeals = allDeals.filter(belongsToOffice);

  // Per-store aggregation.
  const rowByStore = new Map<string, StoreRow>();
  const ensureRow = (store: string): StoreRow => {
    let r = rowByStore.get(store);
    if (!r) {
      r = { store, prevMonth: 0, curMonth: 0, momPct: null, lyMonth: 0, yoyPct: null, ytdTy: 0, ytdLy: 0, ytdPct: null };
      rowByStore.set(store, r);
    }
    return r;
  };
  // Seed every known store so dead ones still show.
  for (const s of office?.storeNumbers ?? []) ensureRow(s);

  for (const d of officeDeals) {
    if (!isPaidOk(d)) continue;
    const store = d.storeNumber || d.hdStore || 'Unknown';
    const r = ensureRow(store);
    const paid = d.datePaid as Date;
    if (inRange(paid, monthStart, monthEnd)) r.curMonth += d.gross;
    if (inRange(paid, prevStart, prevEnd)) r.prevMonth += d.gross;
    if (inRange(paid, lyStart, lyEnd)) r.lyMonth += d.gross;
    if (inRange(paid, ytdStart, monthEnd)) r.ytdTy += d.gross;
    if (inRange(paid, lyYtdStart, lyEnd)) r.ytdLy += d.gross;
  }

  const stores = Array.from(rowByStore.values())
    .map((r) => ({
      ...r,
      momPct: pct(r.curMonth, r.prevMonth),
      yoyPct: pct(r.curMonth, r.lyMonth),
      ytdPct: pct(r.ytdTy, r.ytdLy),
    }))
    .sort((a, b) => b.curMonth - a.curMonth || b.ytdTy - a.ytdTy);

  const sum = (pick: (r: StoreRow) => number) => stores.reduce((acc, r) => acc + pick(r), 0);
  const totalCur = sum((r) => r.curMonth);
  const totalPrev = sum((r) => r.prevMonth);
  const totalLy = sum((r) => r.lyMonth);
  const totalYtdTy = sum((r) => r.ytdTy);
  const totalYtdLy = sum((r) => r.ytdLy);
  const total: StoreRow = {
    store: 'Location Total',
    prevMonth: totalPrev,
    curMonth: totalCur,
    momPct: pct(totalCur, totalPrev),
    lyMonth: totalLy,
    yoyPct: pct(totalCur, totalLy),
    ytdTy: totalYtdTy,
    ytdLy: totalYtdLy,
    ytdPct: pct(totalYtdTy, totalYtdLy),
  };

  // PE/OK pending — awaiting installation, current outstanding, by store.
  const pendMap = new Map<string, { amount: number; count: number }>();
  for (const d of officeDeals) {
    if (d.result !== 'PE/OK') continue;
    const store = d.storeNumber || d.hdStore || 'Unknown';
    const e = pendMap.get(store) || { amount: 0, count: 0 };
    e.amount += d.gross;
    e.count += 1;
    pendMap.set(store, e);
  }
  const pending = Array.from(pendMap.entries())
    .map(([store, v]) => ({ store, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);
  const pendingTotal = pending.reduce((acc, p) => acc + p.amount, 0);

  const deadStores = stores.filter((r) => r.curMonth === 0).map((r) => r.store);

  return {
    office,
    monthLabel,
    year,
    monthIndex,
    stores,
    total,
    pending,
    pendingTotal,
    ytd: { ty: totalYtdTy, ly: totalYtdLy, pct: pct(totalYtdTy, totalYtdLy), gap: totalYtdTy - totalYtdLy },
    deadStores,
    configured,
    error,
  };
}
