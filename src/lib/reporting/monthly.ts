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
  storeNames: Record<string, string>; // store number → name (from Admin → Dealers)
}

export interface StoreRow {
  store: string; // store number (stable key)
  label: string; // display label, e.g. "7024 — Barrie"
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
  // PE/OK awaiting installation, attributed by SALE month:
  //  - pendingThisMonth: sold in the month being reported.
  //  - pendingEarlier: sold in an earlier month and still not installed.
  pendingThisMonth: PendingStore[];
  pendingThisMonthTotal: number;
  pendingEarlier: PendingStore[];
  pendingEarlierTotal: number;
  pendingEarlierByMonth: { label: string; total: number; count: number }[];
  ytd: { ty: number; ly: number; pct: number | null; gap: number };
  deadStores: string[];
  configured: boolean;
  error?: string;
}

export interface PendingStore {
  store: string;
  label: string;
  amount: number;
  count: number;
}

function pct(cur: number, base: number): number | null {
  if (base <= 0) return cur > 0 ? null : 0; // null → "New"
  return Math.round(((cur - base) / base) * 100);
}

/** Offices that can appear in a monthly report: portal dealers with HD stores. */
function toOffice(d: { id: string; name: string; homeDepotStores: { number: string; name: string | null }[] }): Office {
  const storeNumbers: string[] = [];
  const storeNames: Record<string, string> = {};
  for (const s of d.homeDepotStores) {
    const num = s.number.trim();
    if (!num) continue;
    if (!storeNumbers.includes(num)) storeNumbers.push(num);
    const nm = (s.name ?? '').trim();
    if (nm && !storeNames[num]) storeNames[num] = nm;
  }
  return { dealerId: d.id, name: d.name, storeNumbers, storeNames };
}

export async function listReportOffices(): Promise<Office[]> {
  const dealers = await prisma.dealer.findMany({
    where: { homeDepotStores: { some: {} } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, homeDepotStores: { select: { number: true, name: true } } },
  });
  return dealers.map(toOffice);
}

export async function getOffice(dealerId: string): Promise<Office | null> {
  const d = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { id: true, name: true, homeDepotStores: { select: { number: true, name: true } } },
  });
  return d ? toOffice(d) : null;
}

/**
 * Derive a readable store name from the journal's "HD Store" label
 * (e.g. "BARRIE - 7024" → "Barrie"), used when a store has no name set in
 * Admin → Dealers. Returns '' when nothing usable remains.
 */
function deriveStoreName(hdStoreRaw: string): string {
  const stripped = hdStoreRaw
    .replace(/\d{3,}/g, '') // remove the store number
    .replace(/[-–—#]/g, ' ') // separators
    .replace(/\bstore\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  // Title-case the remainder.
  return stripped
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
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

  // Store names: prefer the name set in Admin → Dealers; fall back to the name
  // embedded in the journal's HD Store label so they show even before anyone
  // types them in.
  const derivedNames: Record<string, string> = {};
  for (const d of officeDeals) {
    if (d.storeNumber && !derivedNames[d.storeNumber] && d.hdStore) {
      const nm = deriveStoreName(d.hdStore);
      if (nm) derivedNames[d.storeNumber] = nm;
    }
  }
  const nameFor = (num: string): string => office?.storeNames[num] || derivedNames[num] || '';
  const labelFor = (num: string): string => {
    const nm = nameFor(num);
    return nm ? `${num} — ${nm}` : num;
  };

  // Per-store aggregation.
  const rowByStore = new Map<string, StoreRow>();
  const ensureRow = (store: string): StoreRow => {
    let r = rowByStore.get(store);
    if (!r) {
      r = { store, label: labelFor(store), prevMonth: 0, curMonth: 0, momPct: null, lyMonth: 0, yoyPct: null, ytdTy: 0, ytdLy: 0, ytdPct: null };
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
    label: 'Location Total',
    prevMonth: totalPrev,
    curMonth: totalCur,
    momPct: pct(totalCur, totalPrev),
    lyMonth: totalLy,
    yoyPct: pct(totalCur, totalLy),
    ytdTy: totalYtdTy,
    ytdLy: totalYtdLy,
    ytdPct: pct(totalYtdTy, totalYtdLy),
  };

  // PE/OK pending — awaiting installation — attributed by SALE month. Split into
  // deals sold in the reported month vs still-outstanding deals sold earlier.
  // Pendings sold AFTER the reported month are excluded (not yet relevant to it).
  const pendThis = new Map<string, { amount: number; count: number }>();
  const pendEarlier = new Map<string, { amount: number; count: number }>();
  const pendEarlierMonth = new Map<string, { total: number; count: number; sort: number }>();
  const bump = (m: Map<string, { amount: number; count: number }>, store: string, amt: number) => {
    const e = m.get(store) || { amount: 0, count: 0 };
    e.amount += amt;
    e.count += 1;
    m.set(store, e);
  };
  for (const d of officeDeals) {
    if (d.result !== 'PE/OK') continue;
    if (!d.date || d.date > monthEnd) continue; // ignore pendings sold after the reported month
    const store = d.storeNumber || d.hdStore || 'Unknown';
    if (d.date >= monthStart) {
      bump(pendThis, store, d.gross);
    } else {
      bump(pendEarlier, store, d.gross);
      const label = d.date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const em = pendEarlierMonth.get(label) || { total: 0, count: 0, sort: d.date.getFullYear() * 12 + d.date.getMonth() };
      em.total += d.gross;
      em.count += 1;
      pendEarlierMonth.set(label, em);
    }
  }
  const toPendingArr = (m: Map<string, { amount: number; count: number }>): PendingStore[] =>
    Array.from(m.entries())
      .map(([store, v]) => ({ store, label: labelFor(store), amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount);

  const pendingThisMonth = toPendingArr(pendThis);
  const pendingEarlier = toPendingArr(pendEarlier);
  const pendingThisMonthTotal = pendingThisMonth.reduce((acc, p) => acc + p.amount, 0);
  const pendingEarlierTotal = pendingEarlier.reduce((acc, p) => acc + p.amount, 0);
  const pendingEarlierByMonth = Array.from(pendEarlierMonth.entries())
    .map(([label, v]) => ({ label, total: v.total, count: v.count, sort: v.sort }))
    .sort((a, b) => b.sort - a.sort)
    .map(({ label, total, count }) => ({ label, total, count }));

  const deadStores = stores.filter((r) => r.curMonth === 0).map((r) => r.label);

  return {
    office,
    monthLabel,
    year,
    monthIndex,
    stores,
    total,
    pendingThisMonth,
    pendingThisMonthTotal,
    pendingEarlier,
    pendingEarlierTotal,
    pendingEarlierByMonth,
    ytd: { ty: totalYtdTy, ly: totalYtdLy, pct: pct(totalYtdTy, totalYtdLy), gap: totalYtdTy - totalYtdLy },
    deadStores,
    configured,
    error,
  };
}
