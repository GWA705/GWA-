import type { ReactNode } from 'react';
import type { OfficeMonthlyReport, StoreRow } from '@/lib/reporting/monthly';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

// Portal-styled per-office monthly performance report.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function money2(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Pct({ value, t }: { value: number | null; t: TFunction }) {
  if (value === null) return <span className="font-semibold text-emerald-600">{t('reports.monthly.newBadge')}</span>;
  const up = value >= 0;
  return <span className={`font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>{up ? '+' : ''}{value}%</span>;
}

// Header summary tile (navy background).
function HStat({ label, value, node, emphasize }: { label: string; value?: string; node?: ReactNode; emphasize?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className={`font-bold tabular-nums text-white ${emphasize ? 'text-xl' : 'text-lg'}`}>{node ?? value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}
// Percent styled for the navy header (lighter greens/reds for contrast).
function HPct({ value, t }: { value: number | null; t: TFunction }) {
  if (value === null) return <span className="text-emerald-300">{t('reports.monthly.newBadge')}</span>;
  const up = value >= 0;
  return <span className={up ? 'text-emerald-300' : 'text-red-300'}>{up ? '+' : ''}{value}%</span>;
}

// Split "7024 — Barrie" into a number chip + name.
function splitStore(store: string, label: string): { num: string; name: string | null } {
  const m = label.match(/^(\S+)\s*[—-]\s*(.+)$/);
  if (m) return { num: m[1], name: m[2] };
  return { num: store, name: label !== store ? label : null };
}

function Row({ r, bold, t }: { r: StoreRow; bold?: boolean; t: TFunction }) {
  const base = bold ? 'font-bold text-white' : 'text-gray-800';
  const cell = 'px-2 py-2 text-right tabular-nums';
  return (
    <tr className={bold ? 'bg-slate-800' : 'border-t border-gray-100'}>
      <td className={`px-3 py-2 text-left ${bold ? 'font-bold text-white' : 'font-semibold text-gray-900'}`}>{r.label}</td>
      <td className={`${cell} ${base}`}>{money(r.prevMonth)}</td>
      <td className={`${cell} ${bold ? 'text-white' : 'font-semibold text-gray-900'}`}>{money(r.curMonth)}</td>
      <td className={cell}>
        <Pct value={r.momPct} t={t} />
      </td>
      <td className={`${cell} ${base} hidden sm:table-cell`}>{money(r.lyMonth)}</td>
      <td className={`${cell} hidden sm:table-cell`}>
        <Pct value={r.yoyPct} t={t} />
      </td>
      <td className={`${cell} ${base}`}>{money(r.ytdTy)}</td>
      <td className={`${cell} ${base} hidden md:table-cell`}>{money(r.ytdLy)}</td>
      <td className={cell}>
        <Pct value={r.ytdPct} t={t} />
      </td>
    </tr>
  );
}

// Mobile: a stacked card per store, so phones never need to scroll a wide table.
function StoreCard({ r, bold, t }: { r: StoreRow; bold?: boolean; t: TFunction }) {
  const wrap = bold ? 'bg-slate-800 text-white' : 'bg-white border border-gray-200 shadow-sm';
  const label = bold ? 'text-white/60' : 'text-gray-400';
  const val = bold ? 'text-white' : 'text-gray-900';
  const { num, name } = splitStore(r.store, r.label);
  const cell = (lbl: string, node: ReactNode) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className={`text-[10px] uppercase tracking-wide ${label}`}>{lbl}</span>
      <span className={`tabular-nums ${val}`}>{node}</span>
    </div>
  );
  return (
    <div className={`rounded-2xl p-4 ${wrap}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          {bold ? (
            <div className="font-bold text-white">{r.label}</div>
          ) : (
            <>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-white">{num}</span>
              {name && <span className="font-semibold text-gray-900">{name}</span>}
            </>
          )}
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold tabular-nums ${val}`}>{money(r.curMonth)}</div>
          <div className={`text-[10px] uppercase ${label}`}>{t('reports.monthly.cardThisMonth')}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {cell(t('reports.monthly.colPrevMo'), money(r.prevMonth))}
        {cell(t('reports.monthly.colMoM'), <Pct value={r.momPct} t={t} />)}
        {cell(t('reports.monthly.colLyMo'), money(r.lyMonth))}
        {cell(t('reports.monthly.colYoY'), <Pct value={r.yoyPct} t={t} />)}
        {cell(t('reports.monthly.colYtd'), money(r.ytdTy))}
        {cell(t('reports.monthly.colYtdPct'), <Pct value={r.ytdPct} t={t} />)}
        {cell(t('reports.monthly.colYtdLy'), money(r.ytdLy))}
      </div>
    </div>
  );
}

function PendingBlock({
  title,
  subtitle,
  rows,
  total,
  byMonth,
  t,
}: {
  title: string;
  subtitle: string;
  rows: { store: string; label: string; amount: number; count: number }[];
  total: number;
  byMonth?: { label: string; total: number; count: number }[];
  t: TFunction;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-200 px-4 py-2.5">
        <h3 className="text-sm font-bold text-amber-900">{title}</h3>
        <p className="text-xs text-amber-700">{subtitle}</p>
      </div>
      {byMonth && byMonth.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-amber-100 bg-amber-100/50 px-4 py-2">
          {byMonth.map((m) => (
            <span key={m.label} className="rounded-full bg-white/70 px-2.5 py-1 text-xs text-amber-900 dark:bg-white/10">
              {m.label}: <span className="font-semibold tabular-nums">{money2(m.total)}</span>{' '}
              <span className="text-amber-500">({m.count})</span>
            </span>
          ))}
        </div>
      )}
      <div className="divide-y divide-amber-100">
        {rows.map((p) => (
          <div key={p.store} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="font-semibold text-amber-900">{p.label}</span>
            <span className="tabular-nums text-amber-800">
              {money2(p.amount)} <span className="text-amber-500">({p.count})</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">
          <span>{t('reports.monthly.totalPending')}</span>
          <span className="tabular-nums">{money2(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyReportView({ report }: { report: OfficeMonthlyReport }) {
  const t = getT();
  const ytd = report.ytd;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg,#16233a,#26436a)' }}>
        <div className="p-6 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">{t('reports.monthly.eyebrow')}</div>
          <h1 className="mt-1 text-2xl font-bold leading-tight">{report.office?.name ?? t('reports.monthly.officeFallback')}</h1>
          <div className="mt-0.5 text-sm text-white/60">{report.monthLabel}</div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          <HStat label={t('reports.monthly.thisMonth')} value={money(report.total.curMonth)} emphasize />
          <HStat label={t('reports.monthly.vsLastMonth')} node={<HPct value={report.total.momPct} t={t} />} />
          <HStat label={t('reports.monthly.yearToDate')} value={money(report.total.ytdTy)} />
        </div>
      </div>

      {report.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          {t('reports.monthly.readError', { error: report.error })}
        </div>
      )}
      {report.office && report.office.storeNumbers.length === 0 && (
        <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 p-3 text-sm text-sky-800">
          {t('reports.monthly.noStores')}
        </div>
      )}

      {/* Hint: the full table shows in landscape. Only on small portrait screens. */}
      <p className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-2 text-center text-xs text-gray-500 sm:hidden landscape:hidden">
        <span aria-hidden>↻</span> {t('reports.monthly.rotateHint')}
      </p>

      {/* Mobile: stacked cards (no horizontal scrolling on a phone). */}
      <div className="space-y-2 sm:hidden">
        {report.stores.map((r) => (
          <StoreCard key={r.store} r={r} t={t} />
        ))}
        <StoreCard r={report.total} bold t={t} />
      </div>

      {/* Tablet/desktop: the full comparison table. */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left font-medium">{t('reports.monthly.colStore')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colPrevMo')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colThisMo')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colMoM')}</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">{t('reports.monthly.colLyMo')}</th>
                <th className="px-2 py-2 text-right font-medium hidden sm:table-cell">{t('reports.monthly.colYoY')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colYtd')}</th>
                <th className="px-2 py-2 text-right font-medium hidden md:table-cell">{t('reports.monthly.colYtdLy')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('reports.monthly.colYtdPct')}</th>
              </tr>
            </thead>
            <tbody>
              {report.stores.map((r) => (
                <Row key={r.store} r={r} t={t} />
              ))}
              <Row r={report.total} bold t={t} />
            </tbody>
          </table>
        </div>
      </div>

      {/* PE/OK pending — this month */}
      {report.pendingThisMonth.length > 0 && (
        <PendingBlock
          title={t('reports.monthly.pendingThisTitle')}
          subtitle={t('reports.monthly.pendingThisSubtitle')}
          rows={report.pendingThisMonth}
          total={report.pendingThisMonthTotal}
          t={t}
        />
      )}

      {/* PE/OK pending — earlier months, still outstanding */}
      {report.pendingEarlier.length > 0 && (
        <PendingBlock
          title={t('reports.monthly.pendingEarlierTitle')}
          subtitle={t('reports.monthly.pendingEarlierSubtitle')}
          rows={report.pendingEarlier}
          total={report.pendingEarlierTotal}
          byMonth={report.pendingEarlierByMonth}
          t={t}
        />
      )}

      {/* YTD summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{money(ytd.ty)}</div>
          <div className="text-[10px] uppercase text-gray-500">{t('reports.monthly.ytdThisYear')}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-bold text-gray-900 tabular-nums">{money(ytd.ly)}</div>
          <div className="text-[10px] uppercase text-gray-500">{t('reports.monthly.ytdLastYear')}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-lg font-bold tabular-nums">
            <Pct value={ytd.pct} t={t} />
          </div>
          <div className="text-[10px] uppercase text-gray-500">{t('reports.monthly.ytdVsLastYear')}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className={`text-lg font-bold tabular-nums ${ytd.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {ytd.gap >= 0 ? '+' : '−'}
            {money(Math.abs(ytd.gap))}
          </div>
          <div className="text-[10px] uppercase text-gray-500">{t('reports.monthly.dollarGap')}</div>
        </div>
      </div>

      {report.deadStores.length > 0 && (
        <p className="text-xs text-gray-400">
          {t('reports.monthly.noSalesThisMonth', { stores: report.deadStores.join(', ') })}
        </p>
      )}
    </div>
  );
}
