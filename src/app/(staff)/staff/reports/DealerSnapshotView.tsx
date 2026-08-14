import type { DealerSnapshot, HGSplit, SnapDeal } from '@/lib/reporting/dealerSnapshot';

// Admin quick-glance: one row per dealer with Sold / Paid / Pending (HD vs GWA),
// each expandable to the full paid + pending deal lists.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-CA');
}

function HGTag({ isHD }: { isHD: boolean }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isHD ? 'bg-orange-100 text-orange-700' : 'bg-violet-100 text-violet-700'
      }`}
    >
      {isHD ? 'HD' : 'GWA'}
    </span>
  );
}

// A big number with its HD / GWA breakdown underneath.
function Stat({ label, split, tone }: { label: string; split: HGSplit; tone: 'sold' | 'paid' | 'pending' }) {
  const color =
    tone === 'paid' ? 'text-emerald-600' : tone === 'pending' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{money(split.total)}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
        <span>
          <span className="font-semibold text-orange-600">HD</span> {money(split.hd)}
        </span>
        <span>
          <span className="font-semibold text-violet-600">GWA</span> {money(split.gwa)}
        </span>
      </div>
    </div>
  );
}

function DealList({ title, deals, empty }: { title: string; deals: SnapDeal[]; empty: string }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title} ({deals.length})
      </div>
      {deals.length === 0 ? (
        <p className="text-xs text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {deals.map((d, i) => {
            const row = (
              <div className="flex items-center gap-2 px-3 py-2">
                <HGTag isHD={d.isHD} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{d.name}</span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {d.product || '—'}
                    {d.dateLabel ? ` · ${d.dateLabel}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{money(d.amount)}</span>
              </div>
            );
            return d.link ? (
              <li key={i}>
                <a href={d.link} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50">
                  {row}
                </a>
              </li>
            ) : (
              <li key={i}>{row}</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DealerSnapshotView({ snap }: { snap: DealerSnapshot }) {
  if (snap.error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Couldn&apos;t read the sales journals: {snap.error}
      </div>
    );
  }

  const u = snap.unmatched;
  const hasUnmatched = u.sold.total > 0 || u.paid.total > 0 || u.pending.total > 0;

  return (
    <div className="space-y-5">
      {/* Company totals */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 text-white shadow-sm">
        <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold">
          All dealers · {snap.monthLabel}
        </div>
        <div className="grid grid-cols-3 gap-4 px-5 py-4">
          <TotalStat label="Sold this month" split={snap.totals.sold} />
          <TotalStat label="Paid this month" split={snap.totals.paid} />
          <TotalStat label="Pending now" split={snap.totals.pending} />
        </div>
      </div>

      {snap.rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          No dealer activity for {snap.monthLabel}.
        </div>
      ) : (
        <div className="space-y-3">
          {snap.rows.map((r) => (
            <details key={r.dealerId} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 sm:w-52 sm:shrink-0">
                  <span className="text-gray-300 transition group-open:rotate-90">▸</span>
                  <span className="truncate text-base font-semibold text-gray-900">{r.name}</span>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-4">
                  <Stat label="Sold" split={r.sold} tone="sold" />
                  <Stat label="Paid" split={r.paid} tone="paid" />
                  <Stat label="Pending" split={r.pending} tone="pending" />
                </div>
              </summary>
              <div className="grid gap-4 border-t border-gray-100 bg-gray-50/60 px-5 py-4 lg:grid-cols-2">
                <DealList title="Pending — awaiting install" deals={r.pendingDeals} empty="Nothing pending." />
                <DealList title={`Paid in ${snap.monthLabel}`} deals={r.paidDeals} empty="Nothing paid this month." />
              </div>
            </details>
          ))}
        </div>
      )}

      {hasUnmatched && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
          <span className="font-semibold text-gray-700">Unmatched:</span> some journal deals couldn&apos;t be tied to a
          dealer (no HD store number and no matching location name) — Sold {money(u.sold.total)}, Paid{' '}
          {money(u.paid.total)}, Pending {money(u.pending.total)}. Add the missing HD store numbers under Admin → Dealers,
          or tell us the location labels to map so these attribute correctly.
        </div>
      )}
    </div>
  );
}

function TotalStat({ label, split }: { label: string; split: HGSplit }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-xl font-bold tabular-nums">{money(split.total)}</div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-white/70">
        <span>HD {money(split.hd)}</span>
        <span>GWA {money(split.gwa)}</span>
      </div>
    </div>
  );
}
