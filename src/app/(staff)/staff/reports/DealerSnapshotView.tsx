import type { DealerSnapshot, HGSplit, SnapDeal, LocationMatch, StoreGap } from '@/lib/reporting/dealerSnapshot';

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
function Stat({ label, split, tone }: { label: string; split: HGSplit; tone: 'sold' | 'paid' | 'pending' | 'aged' }) {
  const color =
    tone === 'paid'
      ? 'text-emerald-600'
      : tone === 'pending'
        ? 'text-amber-600'
        : tone === 'aged'
          ? 'text-red-600'
          : 'text-gray-900';
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
  const uPending = u.pendingRecent.total + u.pendingAged.total;
  const hasUnmatched = u.sold.total > 0 || u.paid.total > 0 || uPending > 0;

  return (
    <div className="space-y-5">
      {/* Company totals */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 text-white shadow-sm">
        <div className="border-b border-white/10 px-5 py-3 text-sm font-semibold">
          All dealers · {snap.monthLabel}
        </div>
        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
          <TotalStat label="Sold this month" split={snap.totals.sold} />
          <TotalStat label="Paid this month" split={snap.totals.paid} />
          <TotalStat label="Pending · last 30d" split={snap.totals.pendingRecent} />
          <TotalStat label="Pending · 30+ days" split={snap.totals.pendingAged} />
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
                <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Sold" split={r.sold} tone="sold" />
                  <Stat label="Paid" split={r.paid} tone="paid" />
                  <Stat label="Pending ≤30d" split={r.pendingRecent} tone="pending" />
                  <Stat label="Pending 30+d" split={r.pendingAged} tone="aged" />
                </div>
              </summary>
              <div className="grid gap-4 border-t border-gray-100 bg-gray-50/60 px-5 py-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <DealList
                    title="Pending — last 30 days"
                    deals={r.pendingDeals.filter((d) => !d.aged)}
                    empty="Nothing pending in the last 30 days."
                  />
                  {r.pendingDeals.some((d) => d.aged) && (
                    <DealList title="Pending — older than 30 days" deals={r.pendingDeals.filter((d) => d.aged)} empty="" />
                  )}
                </div>
                <DealList title={`Paid in ${snap.monthLabel}`} deals={r.paidDeals} empty="Nothing paid this month." />
              </div>
            </details>
          ))}
        </div>
      )}

      {hasUnmatched && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <span className="font-semibold">Heads up —</span> some journal deals couldn&apos;t be tied to a dealer: Sold{' '}
          {money(u.sold.total)}, Paid {money(u.paid.total)}, Pending {money(uPending)}. Open the matching plan below to
          see which locations need mapping.
        </div>
      )}

      <MatchingPlan matches={snap.locationMatches} gaps={snap.storeGaps} unboundAliases={snap.unboundAliases} />
    </div>
  );
}

// A verify-the-matching panel: shows how every outside-HD location label and
// every unmapped HD store resolves, so an admin can confirm the right locations
// are matched to the right dealers (or spot what needs fixing).
function MatchingPlan({ matches, gaps, unboundAliases }: { matches: LocationMatch[]; gaps: StoreGap[]; unboundAliases: string[] }) {
  if (matches.length === 0 && gaps.length === 0 && unboundAliases.length === 0) return null;
  const unmatchedCount = matches.filter((m) => !m.dealerName).length;
  const openByDefault = unmatchedCount > 0 || gaps.length > 0 || unboundAliases.length > 0;

  return (
    <details open={openByDefault} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 hover:bg-gray-50">
        <span className="text-gray-300 transition group-open:rotate-90">▸</span>
        <span className="text-sm font-semibold text-gray-900">Matching plan</span>
        <span className="text-xs text-gray-500">— how journal locations map to dealers</span>
        {(unmatchedCount > 0 || gaps.length > 0 || unboundAliases.length > 0) && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {unmatchedCount + gaps.length + unboundAliases.length} need
            {unmatchedCount + gaps.length + unboundAliases.length === 1 ? 's' : ''} attention
          </span>
        )}
      </summary>
      <div className="space-y-5 border-t border-gray-100 px-5 py-4">
        <p className="text-xs text-gray-500">
          HD deals attach by store number automatically. Outside-HD (GWA) deals attach by matching the journal&apos;s
          location label to a dealer name. Check the rows below — anything marked{' '}
          <span className="font-semibold text-red-600">Not matched</span> isn&apos;t counted under a dealer yet.
        </p>

        {unboundAliases.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="font-semibold">Alias rules that couldn&apos;t find a dealer</div>
            <p className="mt-0.5 text-red-700">
              These mapping rules point at a dealer name that isn&apos;t in the system (likely a spelling difference or a
              missing dealer). They aren&apos;t applying until the name matches:
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              {unboundAliases.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {matches.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Outside-HD location labels
            </div>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
              {matches.map((m) => (
                <li key={m.label} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{m.label}</span>
                    <span className="block text-[11px] text-gray-500">
                      {m.count} deal{m.count === 1 ? '' : 's'} · {money(m.gross)}
                    </span>
                  </span>
                  {m.dealerName ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700">→ {m.dealerName}</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Not matched
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {gaps.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              HD store numbers not assigned to any dealer
            </div>
            <p className="mb-1.5 text-[11px] text-gray-500">
              Each store&apos;s deals are listed with the sale date and a journal link — handy for checking a store number
              that may have been mistyped.
            </p>
            <ul className="space-y-2">
              {gaps.map((g) => (
                <li key={g.store} className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">Store {g.store}</span>
                      <span className="block text-[11px] text-gray-500">
                        {g.count} deal{g.count === 1 ? '' : 's'} · {money(g.gross)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      Not assigned
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {g.deals.map((d, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-900">{d.name}</span>
                          <span className="block text-[11px] text-gray-500">{d.dateLabel || 'no date'}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{money(d.amount)}</span>
                        {d.link && (
                          <a
                            href={d.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs font-semibold text-sky-600 hover:underline"
                          >
                            Journal ↗
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-500">
          To fix a mismatch: if a store number is <strong>correct</strong>, add it to the right dealer under{' '}
          <strong>Admin → Dealers</strong>. If it looks <strong>wrong/mistyped</strong>, open the journal link and correct
          it in the sheet. For an outside-HD location label that isn&apos;t matching (or is matching the wrong dealer),
          tell us the label and the dealer it belongs to and we&apos;ll wire an explicit mapping.
        </p>
      </div>
    </details>
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
