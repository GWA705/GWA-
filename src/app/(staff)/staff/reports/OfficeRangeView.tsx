import type { OfficeRangeReport } from '@/lib/reporting/officeRange';
import { ReportPrintButton } from './ReportPrintButton';
import { ReportTile, ReportStamp, reportTheadRow } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

const money = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

/**
 * Custom-range office report, styled as an executive one-pager: a titled header,
 * KPI tiles, and a month × store/office matrix. Print-friendly — the whole
 * report sits in a `.print-sheet` wrapper: visible on screen, and on "Print /
 * Save as PDF" it isolates to a clean sheet with none of the app chrome (see the
 * global @media print rules).
 */
export function OfficeRangeView({ report }: { report: OfficeRangeReport }) {
  const { months, rows, monthTotals, grandTotal, grandCount, rangeLabel, scopeLabel, groupBy } = report;
  const firstColHeader = groupBy === 'office' ? 'Office' : 'Store';
  const unitLabel = groupBy === 'office' ? 'offices' : 'stores';
  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const monthsCount = months.length || 1;
  const avgPerMonth = grandTotal / monthsCount;
  const activeRows = rows.filter((r) => r.total > 0).length;
  let bestMonth: { label: string; total: number } | null = null;
  for (const m of months) {
    const v = monthTotals[m.ym] ?? 0;
    if (!bestMonth || v > bestMonth.total) bestMonth = { label: m.label, total: v };
  }

  const tile = (label: string, value: string, sub?: string) => <ReportTile label={label} value={value} sub={sub} />;
  const t = getT();

  return (
    <div className="print-sheet space-y-5">
      {/* Landscape print — the matrix is wide. */}
      <style>{`@media print { @page { size: landscape; margin: 12mm; } }`}</style>

      {/* Executive header — GWA icon lockup + petrol-navy rule */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-[#123448] pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <img src="/brand/gwa-icon.png" alt="" className="h-9 w-9 flex-none" />
            <div className="text-sm font-bold uppercase tracking-wide text-gray-700">Georgian Water &amp; Air</div>
          </div>
          <h1 className="mt-2.5 text-2xl font-bold text-gray-900">Total Sales</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {scopeLabel || 'All offices'} · Paid on funded deals · <span className="font-medium">{rangeLabel}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ReportPrintButton />
          <div className="text-right text-xs text-gray-400">Generated {generated}</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile('Total sales', money(grandTotal), rangeLabel)}
        {tile('Paid deals', grandCount.toLocaleString('en-CA'), `${activeRows} active ${unitLabel}`)}
        {tile('Average / month', money0(avgPerMonth), `over ${months.length} month${months.length === 1 ? '' : 's'}`)}
        {tile('Best month', bestMonth && bestMonth.total > 0 ? money0(bestMonth.total) : '—', bestMonth?.label ?? '')}
      </div>

      {/* Matrix */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No paid deals found for {scopeLabel || 'these offices'} in {rangeLabel}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={reportTheadRow}>
                <th className="sticky left-0 bg-[#eef3f6] px-4 py-3">{firstColHeader}</th>
                {months.map((m) => (
                  <th key={m.ym} className="px-4 py-3 text-right">{m.label}</th>
                ))}
                <th className="px-4 py-3 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.key} className={i % 2 ? 'bg-gray-50/40' : ''}>
                  <td className="sticky left-0 bg-inherit px-4 py-2.5 font-medium text-gray-800">{r.label}</td>
                  {months.map((m) => {
                    const v = r.byMonth[m.ym] ?? 0;
                    return (
                      <td key={m.ym} className={`px-4 py-2.5 text-right tabular-nums ${v ? 'text-gray-700' : 'text-gray-300'}`}>
                        {v ? money(v) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#123448]/30 bg-[#eef3f6]">
                <td className="sticky left-0 bg-[#eef3f6] px-4 py-3 font-bold text-gray-800">Total</td>
                {months.map((m) => (
                  <td key={m.ym} className="px-4 py-3 text-right font-semibold tabular-nums text-gray-700">
                    {monthTotals[m.ym] ? money(monthTotals[m.ym]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">{money(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Total sales = paid on funded deals (OK money dated by date paid) — reconciles with the Monthly office report.
      </p>

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: generated })} />
    </div>
  );
}
