import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { reportStoreScope } from './monthly';
import { loadDealerMatchIndex } from './dealerMatch';
import { projectYear, projectFutureYear, type MonthCell, type ProjectionResult } from './salesProjection';

/**
 * Paid-gross and paid-deal counts for all 12 calendar months of `year`, scoped
 * to one office (or all offices), binned by Date Paid — identical filters to the
 * office-range / monthly reports so the projection's actuals tie out exactly.
 */
export async function journalMonthlyPaid(
  year: number,
  dealerId: string,
): Promise<{ months: MonthCell[]; configured: boolean; error?: string }> {
  const [read, scope, index] = await Promise.all([
    readJournal(year),
    reportStoreScope(dealerId),
    loadDealerMatchIndex(),
  ]);
  const months: MonthCell[] = Array.from({ length: 12 }, () => ({ gross: 0, count: 0 }));
  const inScope = (d: ReportDeal): boolean => (scope.isAll ? true : index.matchDeal(d) === dealerId);

  for (const d of read.deals) {
    if (d.result !== 'OK' || !d.datePaid) continue;
    if (d.datePaid.getFullYear() !== year) continue; // bin by the paid year
    if (!inScope(d)) continue;
    const m = d.datePaid.getMonth();
    months[m].gross += d.gross;
    months[m].count += 1;
  }
  return { months, configured: read.configured, error: read.error };
}

const annual = (months: MonthCell[]) => ({
  gross: months.reduce((s, m) => s + m.gross, 0),
  deals: months.reduce((s, m) => s + m.count, 0),
});

/**
 * Build the projection for one office (or All offices) and a year. A current or
 * past year measures-and-scales (projectYear); a FUTURE year (no sales yet) is a
 * forward plan grown from the base year by the year-over-year trend
 * (projectFutureYear). `growthPct` overrides the trend for future years only.
 */
export async function buildOfficeProjection(
  year: number,
  dealerId: string,
  growthPct?: number,
): Promise<{ data: ProjectionResult; configured: boolean; error?: string }> {
  const thisYear = new Date().getFullYear();

  if (year <= thisYear) {
    const [cur, prior] = await Promise.all([journalMonthlyPaid(year, dealerId), journalMonthlyPaid(year - 1, dealerId)]);
    return { data: projectYear(cur.months, prior.months, year), configured: cur.configured, error: cur.error };
  }

  // Future year → forward plan. Base = the prior year (year-1): its actuals if
  // that year is already complete, otherwise its own projection.
  const baseYear = year - 1;
  const [base, basePrior] = await Promise.all([
    journalMonthlyPaid(baseYear, dealerId),
    journalMonthlyPaid(baseYear - 1, dealerId),
  ]);

  let baseAnnualGross: number;
  let baseAnnualDeals: number;
  if (baseYear < thisYear) {
    const a = annual(base.months);
    baseAnnualGross = a.gross;
    baseAnnualDeals = a.deals;
  } else {
    const p = projectYear(base.months, basePrior.months, baseYear);
    baseAnnualGross = p.fullYear.expected;
    baseAnnualDeals = p.fullYearDeals;
  }

  const priorYearGross = annual(basePrior.months).gross; // for the growth trend
  // Seasonal shape from the most recent COMPLETE year (base-1); fall back to the
  // base year's shape if that's all we have.
  const shape = (priorYearGross > 0 ? basePrior.months : base.months).map((m) => m.gross);

  const data = projectFutureYear({ year, baseAnnualGross, baseAnnualDeals, priorYearGross, shape, growthPct });
  return { data, configured: base.configured, error: base.error };
}
