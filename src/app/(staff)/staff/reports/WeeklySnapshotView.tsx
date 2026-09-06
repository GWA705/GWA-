import Link from 'next/link';
import type { WeeklySnapshot, WorldStats, FinancingRow, AdminFinancing } from '@/lib/reporting/aggregate';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

// Portal-styled rendering of the weekly leadership snapshot. Server component —
// no interactivity, just a well-composed dashboard.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function Delta({ pct, className = '', t }: { pct: number | null; className?: string; t: TFunction }) {
  if (pct === null) return <span className={`text-gray-400 ${className}`}>—</span>;
  const up = pct >= 0;
  return (
    <span className={`font-semibold ${up ? 'text-emerald-600' : 'text-red-600'} ${className}`}>
      {up ? '▲ +' : '▼ '}
      {pct}% <span className="font-normal text-gray-400">{t('weeklySnapshot.vsLastWeek')}</span>
    </span>
  );
}

function StatTile({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-3">
        <div className="text-lg font-bold leading-tight text-gray-900 tabular-nums">{value}</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function FunnelBar({ funnel, t }: { funnel: WorldStats['funnel']; t: TFunction }) {
  const seg = [
    { pct: funnel.okPct, color: '#3E7BFA', label: t('weeklySnapshot.funnelConfirmed') },
    { pct: funnel.pendingPct, color: '#F59E0B', label: t('weeklySnapshot.funnelPending') },
    { pct: funnel.agingPct, color: '#DC2626', label: t('weeklySnapshot.funnelAgingRisk') },
  ];
  if (funnel.okCount + funnel.pendingCount + funnel.agingCount === 0) {
    return <p className="text-xs text-gray-400">{t('weeklySnapshot.noOpenDeals')}</p>;
  }
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-md">
        {seg.map((s, i) =>
          s.pct > 0 ? <div key={i} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label} ${s.pct}%`} /> : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        {seg.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function FinancingTable({ rows, t }: { rows: FinancingRow[]; t: TFunction }) {
  if (!rows.length) return <p className="text-xs text-gray-400">{t('weeklySnapshot.noFinancing')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left uppercase tracking-wide text-gray-400">
            <th className="py-1.5 pr-2 font-medium">{t('weeklySnapshot.company')}</th>
            <th className="py-1.5 px-2 text-right font-medium">{t('weeklySnapshot.thisWeek')}</th>
            <th className="py-1.5 px-2 text-right font-medium">{t('weeklySnapshot.mtd')}</th>
            <th className="py-1.5 pl-2 text-right font-medium">{t('weeklySnapshot.ytd')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.company} className="border-t border-gray-100">
              <td className="py-1.5 pr-2 font-semibold text-gray-800">{r.company}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">
                {r.weekCount} · {money(r.weekTotal)}
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{money(r.mtdTotal)}</td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gray-900">{money(r.ytdTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniBars({ items, t }: { items: { name: string; value: number }[]; t: TFunction }) {
  if (!items.length) return <p className="text-xs text-gray-400">{t('weeklySnapshot.none')}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.slice(0, 8).map((i) => (
        <div key={i.name} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate font-medium text-gray-700" title={i.name}>
            {i.name}
          </span>
          <span className="h-3 flex-1 rounded bg-gray-100">
            <span
              className="block h-3 rounded bg-sky-500"
              style={{ width: `${Math.max(4, Math.round((i.value / max) * 100))}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums text-gray-700">{money(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

function WorldSection({ w, accent, t }: { w: WorldStats; accent: string; t: TFunction }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-1.5" style={{ background: accent }} />
      <div className="space-y-5 p-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">{w.title}</h3>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-lg font-bold text-gray-900 tabular-nums">{money(w.weekTotal)}</div>
            <div className="text-[10px] uppercase text-gray-500">
              {t('weeklySnapshot.statusOkPending', { ok: w.okCount, pe: w.peCount })}
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 tabular-nums">{money(w.mtdTotal)}</div>
            <div className="text-[10px] uppercase text-gray-500">{t('weeklySnapshot.monthToDate')}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 tabular-nums">{money(w.ytdTotal)}</div>
            <div className="text-[10px] uppercase text-gray-500">{t('weeklySnapshot.yearToDate')}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('weeklySnapshot.dealStatusThisMonth')}</div>
          <FunnelBar funnel={w.funnel} t={t} />
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('weeklySnapshot.pendingBySaleMonth')}</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[w.pending.thisMonth, w.pending.lastMonth, w.pending.older].map((b, i) => (
              <div key={i}>
                <div className="font-bold text-amber-700 tabular-nums">{money(b.total)}</div>
                <div className="text-[10px] text-gray-500">
                  {b.label} ({b.count})
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('weeklySnapshot.financing')}</div>
          <FinancingTable rows={w.financingTable} t={t} />
        </div>

        {w.pendingByLocation.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('weeklySnapshot.pendingByLocation')}</div>
            <MiniBars items={w.pendingByLocation} t={t} />
          </div>
        )}

        {w.agingFlags.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('weeklySnapshot.agingFlags')}</div>
            <div className="space-y-1.5">
              {w.agingFlags.slice(0, 12).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${f.alert ? 'bg-red-600' : 'bg-amber-600'}`}
                  >
                    {t('weeklySnapshot.weeksBadge', { n: f.weeks })}
                  </span>
                  <span className="font-semibold text-gray-800">{f.lastName || t('weeklySnapshot.noName')}</span>
                  <span className="text-gray-400">({f.location})</span>
                  <span className="tabular-nums text-gray-600">{money(f.gross)}</span>
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                    {t('weeklySnapshot.viewArrow')}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function WeeklySnapshotView({ snap, weeksOffset }: { snap: WeeklySnapshot; weeksOffset: number }) {
  const t = getT();
  const h = snap.headline;
  const prevHref = `/staff/reports/weekly?weeks=${weeksOffset - 1}`;
  const nextHref = `/staff/reports/weekly?weeks=${weeksOffset + 1}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg,#16233a,#26436a)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-white">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">{t('weeklySnapshot.eyebrow')}</div>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{t('weeklySnapshot.title')}</h1>
            <div className="mt-0.5 text-sm text-white/60">{snap.weekLabel}</div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link href={prevHref} className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
              {t('weeklySnapshot.prev')}
            </Link>
            {weeksOffset < 0 && (
              <Link href={nextHref} className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
                {t('weeklySnapshot.next')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {snap.dataHealth.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          {t('weeklySnapshot.journalReadError', { error: snap.dataHealth.error })}
        </div>
      )}
      {snap.zeroWeek && !snap.dataHealth.error && (
        <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-800">
          {t('weeklySnapshot.zeroWeek')}
        </div>
      )}

      {/* Stat strip */}
      <div
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${
          snap.adminFinancing.hasData ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        }`}
      >
        <StatTile value={money(h.weekTotal)} label={t('weeklySnapshot.soldThisWeek')} accent="#F96302" />
        <StatTile value={money(h.mtdTotal)} label={t('weeklySnapshot.monthToDate')} accent="#1a5fa8" />
        <StatTile value={money(h.ytdTotal)} label={t('weeklySnapshot.yearToDate')} accent="#1a2e44" />
        <StatTile value={money(h.pendingPaymentTotal)} label={t('weeklySnapshot.pendingPaymentUnpaid')} accent="#F59E0B" />
        <StatTile value={`${h.pacePct}%`} label={t('weeklySnapshot.ofPace')} accent="#7c3aed" />
        {snap.adminFinancing.hasData && (
          <StatTile
            value={money(snap.adminFinancing.ytd.profit)}
            label={t('weeklySnapshot.adminFeesYtd')}
            accent="#059669"
          />
        )}
      </div>

      {/* Highlights */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600">
        <Delta pct={h.trendPct} t={t} />
        <span className="text-gray-300">·</span>
        <span>
          {t('weeklySnapshot.sameWeekLastYear')} <span className="font-semibold text-gray-800 tabular-nums">{money(h.lastYearTotal)}</span>
        </span>
        {h.topLocation && (
          <>
            <span className="text-gray-300">·</span>
            <span>
              {t('weeklySnapshot.topLocation')} <span className="font-semibold text-gray-800">{h.topLocation.name}</span>{' '}
              <span className="tabular-nums">({money(h.topLocation.value)})</span>
            </span>
          </>
        )}
        {h.topCompany && (
          <>
            <span className="text-gray-300">·</span>
            <span>
              {t('weeklySnapshot.topFinancing')} <span className="font-semibold text-gray-800">{h.topCompany.name}</span>{' '}
              <span className="tabular-nums">({money(h.topCompany.value)})</span>
            </span>
          </>
        )}
      </div>

      {/* Two worlds */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WorldSection w={snap.hd} accent="#F96302" t={t} />
        <WorldSection w={snap.outside} accent="#1a5fa8" t={t} />
      </div>

      {/* Georgian Water & Air admin fees (outside-HD financing) */}
      {snap.adminFinancing.hasData && <AdminFinancingPanel a={snap.adminFinancing} t={t} />}

      {/* Data health */}
      <DataHealthPanel snap={snap} t={t} />
    </div>
  );
}

function AdminFinancingPanel({ a, t }: { a: AdminFinancing; t: TFunction }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="h-1" style={{ background: '#059669' }} />
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">{t('weeklySnapshot.adminFeesTitle')}</h3>
          <span className="text-xs text-gray-500">
            {t('weeklySnapshot.fromSource')} <span className="font-medium text-gray-700">MISC. DEALS/INSTALLS</span> · {money(a.feePerDeal)}{t('weeklySnapshot.perFinancedDeal')}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {t('weeklySnapshot.adminExplainer')}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-lg font-bold tabular-nums text-emerald-800">{money(a.week.profit)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              {t('weeklySnapshot.thisWeek')} · {t(a.week.deals === 1 ? 'weeklySnapshot.dealCountOne' : 'weeklySnapshot.dealCountMany', { n: a.week.deals })}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-lg font-bold tabular-nums text-emerald-800">{money(a.mtd.profit)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              {t('weeklySnapshot.monthToDate')} · {t(a.mtd.deals === 1 ? 'weeklySnapshot.dealCountOne' : 'weeklySnapshot.dealCountMany', { n: a.mtd.deals })}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-lg font-bold tabular-nums text-emerald-800">{money(a.ytd.profit)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
              {t('weeklySnapshot.yearToDate')} · {t(a.ytd.deals === 1 ? 'weeklySnapshot.dealCountOne' : 'weeklySnapshot.dealCountMany', { n: a.ytd.deals })}
            </div>
          </div>
        </div>

        {a.byCompany.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {t('weeklySnapshot.financedDealsByCompany')}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="pb-1 text-left font-medium">{t('weeklySnapshot.company')}</th>
                  <th className="pb-1 text-right font-medium">{t('weeklySnapshot.thisWeek')}</th>
                  <th className="pb-1 text-right font-medium">{t('weeklySnapshot.mtd')}</th>
                  <th className="pb-1 text-right font-medium">{t('weeklySnapshot.ytd')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {a.byCompany.map((c) => (
                  <tr key={c.company}>
                    <td className="py-1.5 font-medium text-gray-900">{c.company}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-700">{c.weekCount}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-700">{c.mtdCount}</td>
                    <td className="py-1.5 text-right tabular-nums text-gray-700">{c.ytdCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function DataHealthPanel({ snap, t }: { snap: WeeklySnapshot; t: TFunction }) {
  const d = snap.dataHealth;
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900">{t('weeklySnapshot.journalDataHealth')}</h3>
        <span className="text-xs text-gray-500">
          {t(d.tabsProcessed === 1 ? 'weeklySnapshot.monthTabOne' : 'weeklySnapshot.monthTabMany', { n: d.tabsProcessed })}
          {d.derivedCount > 0
            ? ` · ${t(d.derivedCount === 1 ? 'weeklySnapshot.derivedOne' : 'weeklySnapshot.derivedMany', { n: d.derivedCount })}`
            : ''}
        </span>
      </div>
      {d.tabsSkipped.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          {t(d.tabsSkipped.length === 1 ? 'weeklySnapshot.tabsSkippedOne' : 'weeklySnapshot.tabsSkippedMany', { n: d.tabsSkipped.length })}
          {d.tabsSkipped.map((t2) => `${t2.tab} (${t2.reason})`).join(', ')}
        </p>
      )}
      {d.totalIssues === 0 ? (
        <p className="mt-2 text-xs text-emerald-700">{t('weeklySnapshot.noIssues')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {d.issuesByType.map((it) => (
            <li key={it.type} className="text-xs">
              <span className="font-semibold text-amber-700">
                {it.count} — {it.label}
              </span>
              <span className="text-gray-500">
                :{' '}
                {it.samples.map((s, i) => (
                  <span key={i}>
                    {i > 0 && '; '}
                    {s.customer || t('weeklySnapshot.noName')} [{s.tab} r{s.row}] &ldquo;{s.rawValue}&rdquo;{' '}
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                      {t('weeklySnapshot.viewLink')}
                    </a>
                  </span>
                ))}
                {it.count > it.samples.length && `; ${t('weeklySnapshot.moreCount', { n: it.count - it.samples.length })}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
