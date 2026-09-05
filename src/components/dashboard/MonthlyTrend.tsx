/** Monthly application volume — simple bars, real counts. */
export function MonthlyTrend({ months }: { months: { label: string; value: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-[#0d2a63] dark:text-slate-100">Applications This Month</h3>
      <div className="flex h-[180px] items-end justify-around px-6 pb-4">
        {months.map((m) => (
          <div key={m.label} className="flex h-full flex-col items-center justify-end">
            <div className="mb-2 text-xs font-bold text-gray-700">{m.value}</div>
            <div
              className="w-12 rounded-t-lg bg-gradient-to-t from-blue-700 to-blue-400"
              style={{ height: `${Math.max(6, Math.round((m.value / max) * 130))}px` }}
            />
            <div className="mt-2 text-xs text-gray-500">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
