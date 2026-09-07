import { getT } from '@/i18n/server';

const CHART_H = 168; // px, plotting area height

/** Monthly application volume — gridded bars with tracks, real counts. */
export function MonthlyTrend({ months }: { months: { label: string; value: number }[] }) {
  const t = getT();
  const max = Math.max(1, ...months.map((m) => m.value));
  // Round the axis up to a "nice" top so gridlines read cleanly.
  const top = max <= 3 ? max : Math.ceil(max / 5) * 5;

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_30px_-18px_rgba(16,24,40,.22)]">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[#0d2a63] dark:text-slate-100">{t('dashboard.appsThisMonth')}</h3>

      <div className="relative mt-5" style={{ height: CHART_H }}>
        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-gray-100" style={{ bottom: `${f * 100}%` }} />
        ))}
        {/* bars */}
        <div className="absolute inset-0 flex items-end justify-around gap-3">
          {months.map((m) => {
            const h = Math.max(4, Math.round((m.value / top) * CHART_H));
            return (
              <div key={m.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div className="mb-1.5 text-sm font-bold tabular-nums text-[#10265a] dark:text-slate-100">{m.value}</div>
                {/* track + bar */}
                <div className="relative flex w-full max-w-[56px] justify-center" style={{ height: h }}>
                  <div
                    className="gwa-grow-up w-full rounded-t-xl bg-gradient-to-t from-blue-700 via-blue-600 to-blue-400 shadow-[0_6px_14px_-6px_rgba(37,99,235,.6)]"
                    style={{ height: '100%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* baseline + labels */}
      <div className="mt-2 flex items-center justify-around gap-3 border-t border-gray-200/70 pt-2">
        {months.map((m) => (
          <div key={m.label} className="min-w-0 flex-1 truncate text-center text-xs font-medium text-gray-500">{m.label}</div>
        ))}
      </div>
    </div>
  );
}
