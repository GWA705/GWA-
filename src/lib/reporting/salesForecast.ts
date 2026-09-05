import 'server-only';
import type { ReportRow } from '@/lib/reporting/reportDataset';

/**
 * Simple, honest sales forecasting from a dealer's own history.
 *
 * For a single office the monthly sample is small, so this is a *directional
 * estimate*, not a promise: we take each future calendar month's historical
 * average and scale it by a recent trend factor (last 12 months vs the 12
 * before). Where a month has no history we fall back to the trailing 3-month
 * average. Presented clearly as an estimate.
 */

export interface MonthPoint {
  ym: string; // 'YYYY-MM'
  label: string; // 'Sep 2026'
  count: number;
  total: number;
  projected?: boolean;
}

export interface ForecastResult {
  history: MonthPoint[]; // last 24 months (actuals)
  projection: MonthPoint[]; // next 3 months (estimates)
  trendPct: number; // last-12 vs previous-12 total, as +/-%
  yoy: { month: string; thisYear: number; lastYear: number }[]; // by calendar month
  thisYearLabel: number;
  lastYearLabel: number;
}

const fmt = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

export function salesForecast(rows: ReportRow[]): ForecastResult {
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth();

  // Monthly actuals.
  const monthly = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    const b = monthly.get(r.ym) ?? { count: 0, total: 0 };
    b.count += 1;
    b.total += r.amount;
    monthly.set(r.ym, b);
  }

  // Last 24 months of actuals (fill gaps with zeros).
  const history: MonthPoint[] = [];
  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(curY, curM - i, 1);
    const k = key(d.getFullYear(), d.getMonth());
    const v = monthly.get(k) ?? { count: 0, total: 0 };
    history.push({ ym: k, label: fmt(d.getFullYear(), d.getMonth()), count: v.count, total: v.total });
  }

  // Trend factor: last 12 months total vs the 12 before.
  const last12 = history.slice(12).reduce((s, p) => s + p.total, 0);
  const prev12 = history.slice(0, 12).reduce((s, p) => s + p.total, 0);
  const trend = prev12 > 0 ? last12 / prev12 : 1;
  const trendPct = prev12 > 0 ? Math.round((trend - 1) * 100) : 0;

  // Seasonal average per calendar month (0-11) over all history.
  const byMonth = new Map<number, { total: number; count: number; n: number }>();
  for (const [k, v] of monthly) {
    const m = Number(k.split('-')[1]) - 1;
    const b = byMonth.get(m) ?? { total: 0, count: 0, n: 0 };
    b.total += v.total;
    b.count += v.count;
    b.n += 1;
    byMonth.set(m, b);
  }
  const trailing3Total = history.slice(21).reduce((s, p) => s + p.total, 0) / 3;
  const trailing3Count = history.slice(21).reduce((s, p) => s + p.count, 0) / 3;

  const projection: MonthPoint[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date(curY, curM + i, 1);
    const m = d.getMonth();
    const seas = byMonth.get(m);
    const baseTotal = seas && seas.n > 0 ? seas.total / seas.n : trailing3Total;
    const baseCount = seas && seas.n > 0 ? seas.count / seas.n : trailing3Count;
    projection.push({
      ym: key(d.getFullYear(), m),
      label: fmt(d.getFullYear(), m),
      total: Math.round(baseTotal * trend),
      count: Math.round(baseCount * trend),
      projected: true,
    });
  }

  // Year-over-year by calendar month.
  const yoy = Array.from({ length: 12 }, (_, m) => ({
    month: new Date(2000, m, 1).toLocaleDateString('en-CA', { month: 'short' }),
    thisYear: monthly.get(key(curY, m))?.total ?? 0,
    lastYear: monthly.get(key(curY - 1, m))?.total ?? 0,
  }));

  return { history, projection, trendPct, yoy, thisYearLabel: curY, lastYearLabel: curY - 1 };
}
