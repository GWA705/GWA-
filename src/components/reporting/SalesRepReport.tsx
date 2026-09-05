const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

export interface RepStat {
  name: string;
  count: number;
  total: number;
  avg: number;
  topProgram: string;
}

export function SalesRepReport({ reps, rangeLabel }: { reps: RepStat[]; rangeLabel: string }) {
  const peak = Math.max(1, ...reps.map((r) => r.total));
  const totalDeals = reps.reduce((s, r) => s + r.count, 0);
  const totalValue = reps.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sales reps</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{reps.length}</div>
          <div className="text-xs text-gray-500">{rangeLabel}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Deals</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{totalDeals}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total value</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{money(totalValue)}</div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">By sales rep</h3>
          <p className="text-xs text-gray-500">Each rep&rsquo;s deals, total and average sale value — {rangeLabel.toLowerCase()}.</p>
        </div>
        {reps.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No sales in this range yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Sales rep</th>
                  <th className="px-4 py-3 text-left">Total value</th>
                  <th className="px-4 py-3 text-right">Deals</th>
                  <th className="px-4 py-3 text-right">Avg</th>
                  <th className="px-4 py-3 text-left">Top program</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => (
                  <tr key={r.name} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400" style={{ width: `${Math.max(3, (r.total / peak) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold tabular-nums text-gray-900">{money(r.total)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">{r.count}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{money(r.avg)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.topProgram}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="px-1 text-xs text-gray-400">Based on approved-or-beyond deals, using the approved amount (falling back to requested).</p>
    </div>
  );
}
