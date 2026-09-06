import type { ForecastResult } from '@/lib/reporting/salesForecast';
import { getT } from '@/i18n/server';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

export function SalesForecastView({ data }: { data: ForecastResult }) {
  const t = getT();
  const recent = data.history.slice(12); // last 12 actual months
  const series = [...recent, ...data.projection];
  const peak = Math.max(1, ...series.map((p) => p.total));
  const projTotal = data.projection.reduce((s, p) => s + p.total, 0);
  const trendUp = data.trendPct >= 0;

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesForecast.trend12moLabel')}</div>
          <div className={`mt-1 text-2xl font-bold tabular-nums ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trendUp ? '▲' : '▼'} {Math.abs(data.trendPct)}%
          </div>
          <div className="text-xs text-gray-500">{t('salesForecast.trend12moHint')}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesForecast.projectedNext3Label')}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{money(projTotal)}</div>
          <div className="text-xs text-gray-500">{t('salesForecast.estimatedTotalValue')}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesForecast.projectedDealsLabel')}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{data.projection.reduce((s, p) => s + p.count, 0)}</div>
          <div className="text-xs text-gray-500">{t('salesForecast.next3MonthsEstimate')}</div>
        </div>
      </div>

      {/* History + projection bars */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{t('salesForecast.monthlyHeading')}</h3>
          <p className="text-xs text-gray-500">{t('salesForecast.monthlyHint')}</p>
        </div>
        <div className="overflow-x-auto p-5">
          <div className="flex min-w-[640px] items-end gap-2" style={{ height: 200 }}>
            {series.map((p) => (
              <div key={p.ym} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-gray-400">{p.total > 0 ? money(p.total) : ''}</span>
                <div
                  className={`w-full rounded-t ${p.projected ? 'bg-blue-300/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.5)_4px,rgba(255,255,255,0.5)_8px)]' : 'bg-gradient-to-t from-blue-600 to-sky-400'}`}
                  style={{ height: `${Math.max(2, (p.total / peak) * 160)}px` }}
                  title={p.projected
                    ? t('salesForecast.barTooltipEstimate', { label: p.label, value: money(p.total) })
                    : t('salesForecast.barTooltip', { label: p.label, value: money(p.total) })}
                />
                <span className="text-[10px] text-gray-500">{p.label.replace(/ /, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Year over year */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{t('salesForecast.yoyHeading')}</h3>
          <p className="text-xs text-gray-500">{t('salesForecast.yoyHint', { thisYear: data.thisYearLabel, lastYear: data.lastYearLabel })}</p>
        </div>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-4 py-2 text-left">{t('salesForecast.colMonth')}</th>
                <th className="px-4 py-2 text-right">{data.thisYearLabel}</th>
                <th className="px-4 py-2 text-right">{data.lastYearLabel}</th>
                <th className="px-4 py-2 text-right">{t('salesForecast.colChange')}</th>
              </tr>
            </thead>
            <tbody>
              {data.yoy.map((r) => {
                const change = r.lastYear > 0 ? Math.round(((r.thisYear - r.lastYear) / r.lastYear) * 100) : null;
                return (
                  <tr key={r.month} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{r.month}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-900">{r.thisYear ? money(r.thisYear) : '—'}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-500">{r.lastYear ? money(r.lastYear) : '—'}</td>
                    <td className={`px-4 py-2 text-right text-sm tabular-nums ${change === null ? 'text-gray-400' : change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {change === null ? '—' : `${change >= 0 ? '+' : ''}${change}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-xs text-gray-400">
        {t('salesForecast.footerNote')}
      </p>
    </div>
  );
}
