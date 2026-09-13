import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import type { OfficeMonthlyReport, PendingStore } from '@/lib/reporting/monthly';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { StoreTable } from './StoreTable';
import { ReportHeader, ReportTile, ReportTiles, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

// Portal-styled per-office monthly performance report.

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function money2(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// yyyy-mm-dd → "Sep 2" (parsed as local midnight to avoid a TZ off-by-one).
function fmtSaleDate(ymd: string): string {
  if (!ymd) return '—';
  const d = new Date(`${ymd}T00:00:00`);
  return isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
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
  rows: PendingStore[];
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
          <div key={p.store} className="px-4 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-900">{p.label}</span>
              <span className="tabular-nums text-amber-800">
                {money2(p.amount)} <span className="text-amber-500">({p.count})</span>
              </span>
            </div>
            {/* Per-deal detail — desktop only, keeps the mobile snapshot compact.
                Each links to the customer's deal in the system when matched. */}
            {p.sales && p.sales.length > 0 && (
              <ul className="mt-1.5 hidden space-y-0.5 md:block">
                {p.sales.map((s, i) => {
                  const inner = (
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-amber-500">{fmtSaleDate(s.saleDate)}</span>
                        {' · '}
                        <span className="font-medium text-amber-900">{s.customerName}</span>
                        {s.product ? <span className="text-amber-700"> — {s.product}</span> : null}
                      </span>
                      <span className="flex-none tabular-nums text-amber-800">{money2(s.amount)}</span>
                    </span>
                  );
                  return (
                    <li key={`${s.hdRef}-${i}`} className="text-xs">
                      {s.appId ? (
                        <a href={`/staff/applications/${s.appId}`} className="block rounded px-2 py-1 hover:bg-amber-100">
                          {inner}
                        </a>
                      ) : (
                        <span className="block px-2 py-1 text-amber-800/80" title="No matching deal in the portal">
                          {inner}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
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

export function MonthlyReportView({ report, org, orgLogoUrl }: { report: OfficeMonthlyReport; org?: string; orgLogoUrl?: string | null }) {
  const t = getT();
  const ytd = report.ytd;
  return (
    <div className="space-y-5">
      <ReportHeader
        org={org}
        logoUrl={orgLogoUrl}
        title={t('reports.tabMonthly')}
        scope={`${report.office?.name ?? t('reports.monthly.officeFallback')} · ${report.monthLabel}`}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <ReportTiles cols={3}>
        <ReportTile label={t('reports.monthly.thisMonth')} value={money(report.total.curMonth)} />
        <ReportTile label={t('reports.monthly.vsLastMonth')} value={<Pct value={report.total.momPct} t={t} />} />
        <ReportTile label={t('reports.monthly.yearToDate')} value={money(report.total.ytdTy)} />
      </ReportTiles>

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
      <ReportTiles cols={4}>
        <ReportTile label={t('reports.monthly.ytdThisYear')} value={money(ytd.ty)} />
        <ReportTile label={t('reports.monthly.ytdLastYear')} value={money(ytd.ly)} />
        <ReportTile label={t('reports.monthly.ytdVsLastYear')} value={<Pct value={ytd.pct} t={t} />} />
        <ReportTile
          label={t('reports.monthly.dollarGap')}
          value={
            <span className={ytd.gap >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {ytd.gap >= 0 ? '+' : '−'}
              {money(Math.abs(ytd.gap))}
            </span>
          }
        />
      </ReportTiles>

      {report.deadStores.length > 0 && (
        <p className="text-xs text-gray-400">
          {t('reports.monthly.noSalesThisMonth', { stores: report.deadStores.join(', ') })}
        </p>
      )}

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
