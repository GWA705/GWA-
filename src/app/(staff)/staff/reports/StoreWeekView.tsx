import type { StoreWeekReport, StoreBlock } from '@/lib/reporting/storeWeek';

function money2(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Split a store label like "7024 — Barrie" into its number chip + name.
function splitLabel(store: string, label: string): { num: string; name: string | null } {
  const m = label.match(/^(\S+)\s*[—-]\s*(.+)$/);
  if (m) return { num: m[1], name: m[2] };
  return { num: store, name: label !== store ? label : null };
}

// Split a product string ("COUNTRY, WS, UV12") into chips.
function productChips(product: string): string[] {
  return product
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export function StoreWeekView({ report, showLinks = true }: { report: StoreWeekReport; showLinks?: boolean }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg,#16233a,#26436a)' }}>
        <div className="p-6 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">GWA HD · Weekly store detail</div>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{report.office?.name ?? 'Office'}</h1>
          <div className="mt-0.5 text-sm text-white/60">{report.weekLabel}</div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          <Stat label="Total sold" value={money2(report.grandTotal)} emphasize />
          <Stat label="Deals" value={String(report.grandCount)} />
          <Stat label="Stores" value={String(report.stores.length)} />
        </div>
      </div>

      {report.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn&apos;t fully read the journals: {report.error}.
        </div>
      )}

      {report.stores.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No deals recorded for this office in the selected week.
        </div>
      ) : (
        <div className="space-y-4">
          {report.stores.map((s) => (
            <StoreCard key={s.store} block={s} showLinks={showLinks} />
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-gray-400">
        Money basis: gross sale, dated by date of sale. Includes OK (confirmed) and PE/OK (pending install) deals.
        Sourced from the sales journals.
      </p>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className={`font-bold tabular-nums text-white ${emphasize ? 'text-xl' : 'text-lg'}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}

function StoreCard({ block, showLinks }: { block: StoreBlock; showLinks: boolean }) {
  const { num, name } = splitLabel(block.store, block.label);
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Store header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <span className="rounded-lg bg-slate-800 px-2 py-1 font-mono text-xs font-bold tracking-wide text-white">{num}</span>
        {name && <span className="text-sm font-semibold text-gray-900">{name}</span>}
        <span className="ml-auto text-right">
          <span className="text-base font-bold tabular-nums text-gray-900">{money2(block.total)}</span>
          <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {block.count} {block.count === 1 ? 'deal' : 'deals'}
          </span>
        </span>
      </div>

      {/* Customer rows */}
      <div className="divide-y divide-gray-50">
        {block.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${l.result === 'PE/OK' ? 'bg-amber-400' : 'bg-emerald-500'}`}
              title={l.result === 'PE/OK' ? 'Pending install' : 'Confirmed'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold uppercase tracking-wide text-gray-900">{l.lastName}</span>
                {l.result === 'PE/OK' && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Pending
                  </span>
                )}
              </div>
              {l.product && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {productChips(l.product).map((p, j) => (
                    <span key={j} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums text-gray-900">{money2(l.amount)}</div>
              {showLinks && (
                <a href={l.link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-600 hover:underline">
                  journal ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
