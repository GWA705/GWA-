import type { StoreWeekReport } from '@/lib/reporting/storeWeek';

function money2(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StoreWeekView({ report, showLinks = true }: { report: StoreWeekReport; showLinks?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-xl" style={{ background: 'linear-gradient(135deg,#1a2e44,#243d5c)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-white">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">GWA HD · Weekly Store Detail</div>
            <h1 className="text-xl font-bold">{report.office?.name ?? 'Office'}</h1>
            <div className="mt-0.5 text-sm text-white/70">{report.weekLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{money2(report.grandTotal)}</div>
            <div className="text-[11px] uppercase text-white/60">
              {report.grandCount} deal{report.grandCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {report.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t fully read the journals: {report.error}.
        </div>
      )}

      {report.stores.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
          No deals recorded for this office in the selected week.
        </div>
      ) : (
        <div className="space-y-4">
          {report.stores.map((s) => (
            <section key={s.store} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <h3 className="text-sm font-bold text-gray-900">Store {s.store}</h3>
                <div className="text-sm font-bold text-gray-900 tabular-nums">
                  {money2(s.total)} <span className="text-xs font-normal text-gray-400">({s.count})</span>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {s.lines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900">{l.lastName}</span>
                      {l.result === 'PE/OK' && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          pending
                        </span>
                      )}
                      {l.product && <span className="ml-2 truncate text-xs text-gray-400">{l.product}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums text-gray-800">{money2(l.amount)}</span>
                      {showLinks && (
                        <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline">
                          view →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Money basis: gross sale, dated by date of sale. OK + PE/OK (pending) deals. Sourced from the sales journals.
      </p>
    </div>
  );
}
