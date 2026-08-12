import 'server-only';
import { readJournal, type ReportDeal, type JournalIssue, type JournalIssueType } from './journalRead';

/**
 * Aggregation for the weekly leadership snapshot. Mirrors the period logic and
 * groupings of the office's Weekly Snapshot v8 so portal figures tie out.
 *
 * Money basis here = GROSS SALE, dated by DATE OF SALE. (The monthly per-office
 * report, built separately, uses paid-receivable by Date Paid instead.)
 */

const WARN_WEEKS = 2;
const ALERT_WEEKS = 4;
const TRAILING_MONTHS = 3;

// --- date helpers ----------------------------------------------------------

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export interface Window {
  start: Date;
  end: Date;
}

/** Monday 00:00 → Sunday 23:59 of the week containing `date`. */
function getWeekWindow(date: Date): Window {
  const d = new Date(date);
  const day = d.getDay();
  const monday = addDays(d, day === 0 ? -6 : 1 - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = addDays(monday, 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

// --- sums ------------------------------------------------------------------

function sumGross(deals: ReportDeal[]): number {
  return deals.reduce((acc, d) => acc + (d.gross || 0), 0);
}
function sumByKey(deals: ReportDeal[], key: keyof ReportDeal): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const d of deals) {
    const k = String(d[key] || 'Unknown') || 'Unknown';
    totals[k] = (totals[k] || 0) + (d.gross || 0);
  }
  return totals;
}
function countByKey(deals: ReportDeal[], key: keyof ReportDeal): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of deals) {
    const k = String(d[key] || 'Unknown') || 'Unknown';
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
function weeksSince(date: Date | null, asOf: Date): number {
  if (!date) return 0;
  return Math.floor((asOf.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function trailingMonthlyAverage(deals: ReportDeal[], asOf: Date, months: number): number {
  const totalByMonth: Record<string, number> = {};
  for (let i = 1; i <= months; i += 1) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    totalByMonth[`${d.getFullYear()}-${d.getMonth()}`] = 0;
  }
  for (const d of deals) {
    if (d.result !== 'OK' || !d.date) continue;
    const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
    if (Object.prototype.hasOwnProperty.call(totalByMonth, key)) totalByMonth[key] += d.gross;
  }
  const keys = Object.keys(totalByMonth);
  const sum = keys.reduce((acc, k) => acc + totalByMonth[k], 0);
  return keys.length ? sum / keys.length : 0;
}

// --- output types ----------------------------------------------------------

export interface NamedTotal {
  name: string;
  value: number;
}
export interface FinancingRow {
  company: string;
  weekCount: number;
  weekTotal: number;
  mtdTotal: number;
  ytdTotal: number;
}
export interface AgingFlag {
  lastName: string;
  location: string;
  weeks: number;
  gross: number;
  link: string;
  alert: boolean;
}
export interface PendingBucket {
  label: string;
  total: number;
  count: number;
}
export interface WorldStats {
  key: 'HD' | 'OUTSIDE';
  title: string;
  weekTotal: number;
  mtdTotal: number;
  ytdTotal: number;
  okCount: number;
  peCount: number;
  funnel: { okCount: number; pendingCount: number; agingCount: number; okPct: number; pendingPct: number; agingPct: number };
  pending: { thisMonth: PendingBucket; lastMonth: PendingBucket; older: PendingBucket };
  financingWeek: NamedTotal[];
  financingTable: FinancingRow[];
  pendingByLocation: NamedTotal[];
  agingFlags: AgingFlag[];
}
export interface WeeklySnapshot {
  asOf: string;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  headline: {
    weekTotal: number;
    prevWeekTotal: number;
    trendPct: number | null;
    lastYearTotal: number;
    mtdTotal: number;
    ytdTotal: number;
    pendingPaymentTotal: number;
    pacePct: number;
    topLocation: NamedTotal | null;
    topCompany: NamedTotal | null;
  };
  hd: WorldStats;
  outside: WorldStats;
  dataHealth: {
    configured: boolean;
    error?: string;
    tabsProcessed: number;
    tabsSkipped: { tab: string; reason: string }[];
    derivedCount: number;
    issuesByType: { type: JournalIssueType; label: string; count: number; samples: JournalIssue[] }[];
    totalIssues: number;
  };
  zeroWeek: boolean;
}

const ISSUE_LABELS: Record<JournalIssueType, string> = {
  unrecognized_result: 'Unrecognized Result value',
  unparseable_date: 'Unreadable date',
  unrecognized_source_label: 'Unrecognized HD Ref# / source label',
  unrecognized_financing: 'Unrecognized financing label',
  missing_gross_amount: 'Missing gross amount (could not derive)',
  formula_error_in_journal: 'Broken formula in journal (#N/A, #REF!, etc.)',
  missing_financing_on_confirmed_deal: 'Confirmed (OK) deal missing financing info',
  project_loan_without_hd_number: 'Project Loan financing but no HD reference number',
};

function toIso(d: Date): string {
  return d.toISOString();
}

function sortedNamedTotals(totals: Record<string, number>): NamedTotal[] {
  return Object.keys(totals)
    .map((name) => ({ name, value: totals[name] }))
    .sort((a, b) => b.value - a.value);
}

function bucketPendingByAge(
  pending: ReportDeal[],
  monthStart: Date,
  prevMonthStart: Date,
): WorldStats['pending'] {
  const monthLabel = monthStart.toLocaleString('en-US', { month: 'short' });
  const prevLabel = prevMonthStart.toLocaleString('en-US', { month: 'short' });
  const thisMonth: PendingBucket = { label: monthLabel, total: 0, count: 0 };
  const lastMonth: PendingBucket = { label: prevLabel, total: 0, count: 0 };
  const older: PendingBucket = { label: 'Older', total: 0, count: 0 };
  for (const d of pending) {
    if (!d.date) {
      older.total += d.gross;
      older.count += 1;
    } else if (d.date >= monthStart) {
      thisMonth.total += d.gross;
      thisMonth.count += 1;
    } else if (d.date >= prevMonthStart) {
      lastMonth.total += d.gross;
      lastMonth.count += 1;
    } else {
      older.total += d.gross;
      older.count += 1;
    }
  }
  return { thisMonth, lastMonth, older };
}

function buildWorld(
  key: 'HD' | 'OUTSIDE',
  title: string,
  weekDeals: ReportDeal[],
  mtdDeals: ReportDeal[],
  ytdDeals: ReportDeal[],
  pendingAll: ReportDeal[],
  monthStart: Date,
  prevMonthStart: Date,
  asOf: Date,
): WorldStats {
  const okCount = weekDeals.filter((d) => d.result === 'OK').length;
  const peCount = weekDeals.filter((d) => d.result === 'PE/OK').length;

  const funnelOk = mtdDeals.length;
  const agingCount = pendingAll.filter((d) => weeksSince(d.date, asOf) >= WARN_WEEKS).length;
  const pendingCount = pendingAll.length - agingCount;
  const total = funnelOk + pendingCount + agingCount;
  const okPct = total ? Math.round((funnelOk / total) * 100) : 0;
  const pendingPct = total ? Math.round((pendingCount / total) * 100) : 0;
  const agingPct = Math.max(0, 100 - okPct - pendingPct);

  // Financing table (week count+$, MTD $, YTD $) sorted by YTD.
  const companies = new Set<string>();
  [weekDeals, mtdDeals, ytdDeals].forEach((set) => set.forEach((d) => companies.add(d.financeBucket)));
  const weekTotals = sumByKey(weekDeals, 'financeBucket');
  const weekCounts = countByKey(weekDeals, 'financeBucket');
  const mtdTotals = sumByKey(mtdDeals, 'financeBucket');
  const ytdTotals = sumByKey(ytdDeals, 'financeBucket');
  const financingTable: FinancingRow[] = Array.from(companies)
    .map((company) => ({
      company,
      weekCount: weekCounts[company] || 0,
      weekTotal: weekTotals[company] || 0,
      mtdTotal: mtdTotals[company] || 0,
      ytdTotal: ytdTotals[company] || 0,
    }))
    .sort((a, b) => b.ytdTotal - a.ytdTotal);

  const agingFlags: AgingFlag[] = pendingAll
    .filter((d) => weeksSince(d.date, asOf) >= WARN_WEEKS)
    .map((d) => {
      const weeks = weeksSince(d.date, asOf);
      return {
        lastName: d.lastName,
        location: d.location || 'Unknown',
        weeks,
        gross: d.gross,
        link: d.linkUrl,
        alert: weeks >= ALERT_WEEKS,
      };
    })
    .sort((a, b) => b.weeks - a.weeks);

  return {
    key,
    title,
    weekTotal: sumGross(weekDeals),
    mtdTotal: sumGross(mtdDeals),
    ytdTotal: sumGross(ytdDeals),
    okCount,
    peCount,
    funnel: { okCount: funnelOk, pendingCount, agingCount, okPct, pendingPct, agingPct },
    pending: bucketPendingByAge(pendingAll, monthStart, prevMonthStart),
    financingWeek: sortedNamedTotals(weekTotals),
    financingTable,
    pendingByLocation: sortedNamedTotals(sumByKey(pendingAll, 'location')),
    agingFlags,
  };
}

/**
 * Build the full weekly leadership snapshot.
 * @param asOf the "as of" date; the report covers the Mon–Sun week containing it,
 *   plus MTD / YTD up to it. Defaults to today.
 */
export async function buildWeeklySnapshot(asOf: Date = new Date()): Promise<WeeklySnapshot> {
  const [cur, prev] = await Promise.all([readJournal(asOf.getFullYear()), readJournal(asOf.getFullYear() - 1)]);

  const week = getWeekWindow(asOf);
  const prevWeek = getWeekWindow(addDays(asOf, -7));
  const lastYearWeek = getWeekWindow(addDays(asOf, -364));
  const yearStart = new Date(asOf.getFullYear(), 0, 1);
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const prevMonthStart = new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1);

  const isActive = (d: ReportDeal) => d.result === 'OK' || d.result === 'PE/OK';
  const inWindow = (d: ReportDeal, w: Window) => !!d.date && d.date >= w.start && d.date <= w.end;

  const weekDeals = cur.deals.filter((d) => inWindow(d, week) && isActive(d));
  const prevWeekDeals = cur.deals.filter((d) => inWindow(d, prevWeek) && isActive(d));
  const sameWeekLastYear = prev.deals.filter((d) => inWindow(d, lastYearWeek) && isActive(d));
  const mtdDeals = cur.deals.filter((d) => d.result === 'OK' && d.date && d.date >= monthStart && d.date <= asOf);
  const ytdDeals = cur.deals.filter((d) => d.result === 'OK' && d.date && d.date >= yearStart && d.date <= asOf);
  const pending = cur.deals.filter((d) => d.result === 'PE/OK');

  const trailingAvg = trailingMonthlyAverage(cur.deals, asOf, TRAILING_MONTHS);

  // Pending payment = money owed but not yet paid: Date Paid still blank, deal
  // not cancelled (RB), across all locations.
  const pendingPayment = cur.deals.filter((d) => d.result !== 'RB' && !d.datePaid);

  const weekTotal = sumGross(weekDeals);
  const prevWeekTotal = sumGross(prevWeekDeals);
  const lastYearTotal = sumGross(sameWeekLastYear);
  const mtdTotal = sumGross(mtdDeals);
  const trendPct = prevWeekTotal > 0 ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 100) : null;
  const pacePct = trailingAvg > 0 ? Math.round((mtdTotal / trailingAvg) * 100) : 0;

  const topLoc = sortedNamedTotals(sumByKey(weekDeals, 'location'))[0] || null;
  const topCo = sortedNamedTotals(sumByKey(weekDeals, 'financeBucket'))[0] || null;

  const hd = buildWorld(
    'HD',
    'Home Depot Program',
    weekDeals.filter((d) => d.isHD),
    mtdDeals.filter((d) => d.isHD),
    ytdDeals.filter((d) => d.isHD),
    pending.filter((d) => d.isHD),
    monthStart,
    prevMonthStart,
    asOf,
  );
  const outside = buildWorld(
    'OUTSIDE',
    'GWA Outside-HD',
    weekDeals.filter((d) => !d.isHD),
    mtdDeals.filter((d) => !d.isHD),
    ytdDeals.filter((d) => !d.isHD),
    pending.filter((d) => !d.isHD),
    monthStart,
    prevMonthStart,
    asOf,
  );

  // Data health, merged across both years' reads.
  const allIssues = [...cur.issues, ...prev.issues];
  const byType = new Map<JournalIssueType, JournalIssue[]>();
  for (const i of allIssues) {
    const arr = byType.get(i.type) || [];
    arr.push(i);
    byType.set(i.type, arr);
  }
  const issuesByType = Array.from(byType.entries())
    .map(([type, list]) => ({ type, label: ISSUE_LABELS[type], count: list.length, samples: list.slice(0, 5) }))
    .sort((a, b) => b.count - a.count);

  const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

  return {
    asOf: toIso(asOf),
    weekStart: toIso(week.start),
    weekEnd: toIso(week.end),
    weekLabel: `${fmt(week.start)} – ${fmt(week.end)}`,
    headline: {
      weekTotal,
      prevWeekTotal,
      trendPct,
      lastYearTotal,
      mtdTotal,
      ytdTotal: sumGross(ytdDeals),
      pendingPaymentTotal: sumGross(pendingPayment),
      pacePct,
      topLocation: topLoc,
      topCompany: topCo,
    },
    hd,
    outside,
    dataHealth: {
      configured: cur.configured,
      error: cur.error || prev.error,
      tabsProcessed: cur.tabsProcessed + prev.tabsProcessed,
      tabsSkipped: [...cur.tabsSkipped, ...prev.tabsSkipped],
      derivedCount: cur.derivedCount + prev.derivedCount,
      issuesByType,
      totalIssues: allIssues.length,
    },
    zeroWeek: weekDeals.length === 0,
  };
}
