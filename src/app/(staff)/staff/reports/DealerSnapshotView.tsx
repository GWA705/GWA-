import type { DealerSnapshot, HGSplit, SnapDeal, LocationMatch, StoreGap } from '@/lib/reporting/dealerSnapshot';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

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

function DealList({
  title,
  deals,
  empty,
  showPaid,
  t,
}: {
  title: string;
  deals: SnapDeal[];
  empty: string;
  showPaid?: boolean;
  t: TFunction;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
        {title} <span className="text-gray-400">({deals.length})</span>
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
                {showPaid && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {t('dealerSnapshot.paidBadge')}
                  </span>
                )}
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
  const t = getT();

  if (snap.error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {t('dealerSnapshot.readError', { error: snap.error })}
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
          {t('dealerSnapshot.allDealers')} · {snap.monthLabel}
        </div>
        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
          <TotalStat label={t('dealerSnapshot.soldThisMonth')} split={snap.totals.sold} />
          <TotalStat label={t('dealerSnapshot.paidThisMonth')} split={snap.totals.paid} />
          <TotalStat label={t('dealerSnapshot.pendingLast30')} split={snap.totals.pendingRecent} />
          <TotalStat label={t('dealerSnapshot.pending30Plus')} split={snap.totals.pendingAged} />
        </div>
      </div>

      {snap.rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          {t('dealerSnapshot.noActivity', { month: snap.monthLabel })}
        </div>
      ) : (
        <div className="space-y-3">
          {snap.rows.map((r) => (
            <details key={r.dealerId} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 sm:w-56 sm:shrink-0">
                  <span className="text-gray-400 transition group-open:rotate-90">▸</span>
                  <span className="truncate text-lg font-bold text-gray-900">{r.name}</span>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label={t('dealerSnapshot.sold')} split={r.sold} tone="sold" />
                  <Stat label={t('dealerSnapshot.paid')} split={r.paid} tone="paid" />
                  <Stat label={t('dealerSnapshot.pendingRecent')} split={r.pendingRecent} tone="pending" />
                  <Stat label={t('dealerSnapshot.pendingAged')} split={r.pendingAged} tone="aged" />
                </div>
              </summary>
              <div className="grid gap-4 border-t border-gray-100 bg-gray-50/60 px-5 py-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <DealList
                    title={t('dealerSnapshot.pendingLast30Days')}
                    deals={r.pendingDeals.filter((d) => !d.aged)}
                    empty={t('dealerSnapshot.emptyPendingRecent')}
                    t={t}
                  />
                  {r.pendingDeals.some((d) => d.aged) && (
                    <DealList
                      title={t('dealerSnapshot.pendingOlder')}
                      deals={r.pendingDeals.filter((d) => d.aged)}
                      empty=""
                      t={t}
                    />
                  )}
                </div>
                <DealList
                  title={t('dealerSnapshot.paidIn', { month: snap.monthLabel })}
                  deals={r.paidDeals}
                  empty={t('dealerSnapshot.emptyPaid')}
                  showPaid
                  t={t}
                />
              </div>
            </details>
          ))}
        </div>
      )}

      {hasUnmatched && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
          <span className="font-semibold">{t('dealerSnapshot.headsUp')}</span>{' '}
          {t('dealerSnapshot.unmatchedNote', {
            sold: money(u.sold.total),
            paid: money(u.paid.total),
            pending: money(uPending),
          })}
        </div>
      )}

      <MatchingPlan matches={snap.locationMatches} gaps={snap.storeGaps} unboundAliases={snap.unboundAliases} t={t} />
    </div>
  );
}

// A verify-the-matching panel: shows how every outside-HD location label and
// every unmapped HD store resolves, so an admin can confirm the right locations
// are matched to the right dealers (or spot what needs fixing).
function MatchingPlan({
  matches,
  gaps,
  unboundAliases,
  t,
}: {
  matches: LocationMatch[];
  gaps: StoreGap[];
  unboundAliases: string[];
  t: TFunction;
}) {
  if (matches.length === 0 && gaps.length === 0 && unboundAliases.length === 0) return null;
  const unmatchedCount = matches.filter((m) => !m.dealerName).length;
  const openByDefault = unmatchedCount > 0 || gaps.length > 0 || unboundAliases.length > 0;
  const attentionCount = unmatchedCount + gaps.length + unboundAliases.length;

  return (
    <details open={openByDefault} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 hover:bg-gray-50">
        <span className="text-gray-300 transition group-open:rotate-90">▸</span>
        <span className="text-sm font-semibold text-gray-900">{t('dealerSnapshot.matchingPlanTitle')}</span>
        <span className="text-xs text-gray-500">{t('dealerSnapshot.matchingPlanSubtitle')}</span>
        {attentionCount > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            {attentionCount === 1
              ? t('dealerSnapshot.needsAttentionOne', { n: attentionCount })
              : t('dealerSnapshot.needsAttentionMany', { n: attentionCount })}
          </span>
        )}
      </summary>
      <div className="space-y-5 border-t border-gray-100 px-5 py-4">
        <p className="text-xs text-gray-500">
          {t('dealerSnapshot.introBefore')}
          <span className="font-semibold text-red-600">{t('dealerSnapshot.notMatched')}</span>
          {t('dealerSnapshot.introAfter')}
        </p>

        {unboundAliases.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="font-semibold">{t('dealerSnapshot.aliasTitle')}</div>
            <p className="mt-0.5 text-red-700">{t('dealerSnapshot.aliasNote')}</p>
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
              {t('dealerSnapshot.outsideHdLabels')}
            </div>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
              {matches.map((m) => (
                <li key={m.label} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{m.label}</span>
                    <span className="block text-[11px] text-gray-500">
                      {m.count} {m.count === 1 ? t('dealerSnapshot.dealSingular') : t('dealerSnapshot.dealPlural')} ·{' '}
                      {money(m.gross)}
                    </span>
                  </span>
                  {m.dealerName ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700">→ {m.dealerName}</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      {t('dealerSnapshot.notMatched')}
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
              {t('dealerSnapshot.hdStoresUnassigned')}
            </div>
            <p className="mb-1.5 text-[11px] text-gray-500">{t('dealerSnapshot.storesNote')}</p>
            <ul className="space-y-2">
              {gaps.map((g) => (
                <li key={g.store} className="overflow-hidden rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3 bg-gray-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">
                        {t('dealerSnapshot.store', { n: g.store })}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        {g.count} {g.count === 1 ? t('dealerSnapshot.dealSingular') : t('dealerSnapshot.dealPlural')} ·{' '}
                        {money(g.gross)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                      {t('dealerSnapshot.notAssigned')}
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {g.deals.map((d, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-900">{d.name}</span>
                          <span className="block text-[11px] text-gray-500">{d.dateLabel || t('dealerSnapshot.noDate')}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{money(d.amount)}</span>
                        {d.link && (
                          <a
                            href={d.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs font-semibold text-sky-600 hover:underline"
                          >
                            {t('dealerSnapshot.journalLink')}
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
          {t('dealerSnapshot.fixIntro')}
          <strong>{t('dealerSnapshot.fixCorrect')}</strong>
          {t('dealerSnapshot.fixMid1')}
          <strong>{t('dealerSnapshot.fixAdminPath')}</strong>
          {t('dealerSnapshot.fixMid2')}
          <strong>{t('dealerSnapshot.fixWrong')}</strong>
          {t('dealerSnapshot.fixEnd')}
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
