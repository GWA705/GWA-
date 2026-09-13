import type { StoreWeekReport, StoreBlock } from '@/lib/reporting/storeWeek';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { ReportHeader, ReportTile, ReportTiles, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

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

export function StoreWeekView({ report, showLinks = true, org, orgLogoUrl }: { report: StoreWeekReport; showLinks?: boolean; org?: string; orgLogoUrl?: string | null }) {
  const t = getT();
  return (
    <div className="space-y-5">
      <ReportHeader
        org={org}
        logoUrl={orgLogoUrl}
        title={t('reports.tabWeekly')}
        scope={`${report.office?.name ?? t('storeWeek.officeFallback')} · ${report.weekLabel}`}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <ReportTiles cols={3}>
        <ReportTile label={t('storeWeek.totalSold')} value={money2(report.grandTotal)} />
        <ReportTile label={t('storeWeek.deals')} value={String(report.grandCount)} />
        <ReportTile label={t('storeWeek.stores')} value={String(report.stores.length)} />
      </ReportTiles>

      {report.error && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800">
          {t('storeWeek.journalError', { error: report.error })}
        </div>
      )}

      {report.stores.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {t('storeWeek.emptyState')}
        </div>
      ) : (
        <div className="space-y-4">
          {report.stores.map((s) => (
            <StoreCard key={s.store} block={s} showLinks={showLinks} t={t} />
          ))}
        </div>
      )}

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}

function StoreCard({ block, showLinks, t }: { block: StoreBlock; showLinks: boolean; t: TFunction }) {
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
            {block.count} {block.count === 1 ? t('storeWeek.dealSingular') : t('storeWeek.dealPlural')}
          </span>
        </span>
      </div>

      {/* Customer rows */}
      <div className="divide-y divide-gray-50">
        {block.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${l.result === 'PE/OK' ? 'bg-amber-400' : 'bg-emerald-500'}`}
              title={l.result === 'PE/OK' ? t('storeWeek.pendingInstall') : t('storeWeek.confirmed')}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold uppercase tracking-wide text-gray-900">{l.lastName}</span>
                {l.result === 'PE/OK' && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {t('storeWeek.pendingBadge')}
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
                  {t('storeWeek.journalLink')} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
