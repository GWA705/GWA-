import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import type { OfficeMonthlyReport } from '@/lib/reporting/monthly';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { StoreTable } from './StoreTable';

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

// Header summary stat, rendered on the Home Depot–orange KPI band (white text).
// `emphasize` = the hero number (This month); it scales up and, on mobile, spans
// the full width so a large figure (e.g. "$1,809,299") never clips in a narrow
// grid column — the bug this replaces.
function HStat({
  label,
  value,
  node,
  emphasize,
  className = '',
}: {
  label: string;
  value?: string;
  node?: ReactNode;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className={`px-4 py-4 sm:px-5 ${className}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
        <span className="h-2 w-0.5 rounded-full bg-white/50" aria-hidden />
        {label}
      </div>
      <div
        className={`font-extrabold tabular-nums leading-none text-white [text-shadow:0_1px_2px_rgba(120,40,0,0.28)] ${emphasize ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}
      >
        {node ?? value}
      </div>
    </div>
  );
}
function HPct({ value, t }: { value: number | null; t: TFunction }) {
  if (value === null) return <span className="text-white">{t('reports.monthly.newBadge')}</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-1 text-white">
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      {up ? '+' : ''}{value}%
    </span>
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
      {/* Light KPI summary — deliberately distinct from the navy page hero above
          it (avoids two stacked navy blocks). */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_14px_30px_-18px_rgba(16,24,40,.22)]">
        <div className="flex items-center gap-3 p-5">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <BarChart3 size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400">{t('reports.monthly.eyebrow')}</div>
            <h1 className="truncate text-lg font-bold leading-tight text-[#0e2b5c] dark:text-slate-100">{report.office?.name ?? t('reports.monthly.officeFallback')}</h1>
            <div className="text-xs text-gray-500">{report.monthLabel}</div>
          </div>
        </div>
        {/* Home Depot–orange KPI band — given depth so it reads as a crafted panel,
            not a flat slab: a diagonal deep→bright→deep gradient, a lit top-left
            corner sheen, a hairline top highlight, and a soft bottom vignette.
            Mobile: This month spans full width (large) with the two comparison
            stats side-by-side beneath it; sm+: three across. */}
        <div className="relative overflow-hidden">
          {/* base diagonal gradient (deep → bright → deep) */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#E0550A] via-[#F96302] to-[#D24E05]" aria-hidden />
          {/* lit corner sheen for dimension */}
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(130% 150% at 0% 0%, rgba(255,255,255,0.26), rgba(255,255,255,0) 55%)' }}
            aria-hidden
          />
          {/* hairline top highlight + soft bottom vignette */}
          <div className="absolute inset-x-0 top-0 h-px bg-white/45" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" aria-hidden />

          <div className="relative grid grid-cols-2 sm:grid-cols-3">
            <HStat
              label={t('reports.monthly.thisMonth')}
              value={money(report.total.curMonth)}
              emphasize
              className="col-span-2 border-b border-white/15 shadow-[inset_-1px_0_0_rgba(0,0,0,0.06)] sm:col-span-1 sm:border-b-0 sm:border-r"
            />
            <HStat
              label={t('reports.monthly.vsLastMonth')}
              node={<HPct value={report.total.momPct} t={t} />}
              className="border-r border-white/15 shadow-[inset_-1px_0_0_rgba(0,0,0,0.06)]"
            />
            <HStat label={t('reports.monthly.yearToDate')} value={money(report.total.ytdTy)} />
          </div>
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

      {/* Store rows — click one to drill into the sales behind its number.
          (Interactive, so it lives in a small client component.) */}
      <StoreTable stores={report.stores} total={report.total} />

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
