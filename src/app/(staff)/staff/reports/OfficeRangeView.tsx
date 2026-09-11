import type { OfficeRangeReport } from '@/lib/reporting/officeRange';

const money = (n: number) =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Custom-range office report: money put through (paid & received) by month and
 * by store — or by office for the all-offices aggregate — across the chosen
 * span. Print-friendly so each office's copy can be saved/printed as one page.
 */
export function OfficeRangeView({ report }: { report: OfficeRangeReport }) {
  const { months, rows, monthTotals, grandTotal, grandCount, rangeLabel, scopeLabel, groupBy } = report;
  const firstColHeader = groupBy === 'office' ? 'Office' : 'Store';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{scopeLabel || 'Office report'}</h1>
          <p className="text-sm text-gray-500">
            Money put through (paid &amp; received) · <span className="font-medium">{rangeLabel}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{money(grandTotal)}</div>
          <div className="text-xs text-gray-500">{grandCount} paid deal{grandCount === 1 ? '' : 's'}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          No paid deals found for this office in {rangeLabel}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="sticky left-0 bg-gray-50 px-4 py-3">{firstColHeader}</th>
                {months.map((m) => (
                  <th key={m.ym} className="px-4 py-3 text-right">{m.label}</th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-gray-800">{r.label}</td>
                  {months.map((m) => {
                    const v = r.byMonth[m.ym] ?? 0;
                    return (
                      <td key={m.ym} className={`px-4 py-2.5 text-right ${v ? 'text-gray-700' : 'text-gray-300'}`}>
                        {v ? money(v) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{money(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="sticky left-0 bg-gray-50 px-4 py-3 font-semibold text-gray-800">Total</td>
                {months.map((m) => (
                  <td key={m.ym} className="px-4 py-3 text-right font-medium text-gray-700">
                    {monthTotals[m.ym] ? money(monthTotals[m.ym]) : '—'}
                  </td>
                ))}
                <td className="px-4 py-3 text-right font-bold text-gray-900">{money(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Paid &amp; received basis (OK money dated by date paid) — reconciles with the Monthly office report.
        Tip: use your browser&apos;s Print / Save as PDF to hand this to the office.
      </p>
    </div>
  );
}
