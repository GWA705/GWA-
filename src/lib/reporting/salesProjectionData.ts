import 'server-only';
import { readJournal, type ReportDeal } from './journalRead';
import { reportStoreScope } from './monthly';
import { loadDealerMatchIndex } from './dealerMatch';
import type { MonthCell } from './salesProjection';

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
