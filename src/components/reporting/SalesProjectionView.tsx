import type { ProjectionResult } from '@/lib/reporting/salesProjection';
import { getT } from '@/i18n/server';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

export function SalesProjectionView({ data }: { data: ProjectionResult }) {
  const t = getT();
  const peak = Math.max(1, ...data.months.map((m) => Math.max(m.actual, m.projected)));
  const confText = {
    higher: t('salesProjection.confHigher'),
    moderate: t('salesProjection.confModerate'),
    lower: t('salesProjection.confLower'),
  }[data.confidence];

  return (
    <div className="space-y-4">
      {/* Headline band: banked → projected full year */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesProjection.ytdLabel')}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{money0(data.ytd)}</div>
          <div className="text-xs text-gray-500">{t('salesProjection.ytdHint', { deals: data.ytdCount })}</div>
        </div>
        <div className="rounded-2xl border-2 border-gray-900 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesProjection.projectedYearLabel', { year: data.year })}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{money0(data.fullYear.expected)}</div>
          <div className="text-xs text-gray-500">
            {data.isComplete
              ? t('salesProjection.projectedYearFinal')
              : t('salesProjection.projectedYearRange', { low: money0(data.fullYear.low), high: money0(data.fullYear.high) })}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('salesProjection.runRateLabel')}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{money0(data.runRateMonthly)}</div>
          <div className="text-xs text-gray-500">{t('salesProjection.runRateHint', { deals: data.fullYearDeals })}</div>
        </div>
      </div>

      {/* Monthly: banked (solid) + still-to-come (striped), to year-end */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{t('salesProjection.monthlyHeading', { year: data.year })}</h3>
          <p className="text-xs text-gray-500">{t('salesProjection.monthlyHint')}</p>
        </div>
        <div className="overflow-x-auto p-5">
          <div className="flex min-w-[680px] items-end gap-2" style={{ height: 210 }}>
            {data.months.map((m) => {
              const banked = m.actual;
              const extra = Math.max(0, m.projected - m.actual); // still-to-come on a partial/future month
              const total = banked + extra;
              return (
                <div key={m.index} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-gray-400">{total > 0 ? money0(total) : ''}</span>
                  <div className="flex w-full flex-col justify-end" style={{ height: 160 }}>
                    {extra > 0 && (
                      <div
                        className="w-full rounded-t bg-gray-300/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.6)_4px,rgba(255,255,255,0.6)_8px)]"
                        style={{ height: `${Math.max(2, (extra / peak) * 150)}px` }}
                        title={t('salesProjection.barProjected', { label: m.label, value: money(m.projected) })}
                      />
                    )}
                    {banked > 0 && (
                      <div
                        className={`w-full ${extra > 0 ? '' : 'rounded-t'} bg-gradient-to-t from-gray-800 to-gray-500`}
                        style={{ height: `${Math.max(2, (banked / peak) * 150)}px` }}
                        title={t('salesProjection.barActual', { label: m.label, value: money(banked) })}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] ${m.isProjected ? 'text-gray-400' : 'text-gray-600'}`}>{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-gradient-to-t from-gray-800 to-gray-500" />{t('salesProjection.legendBanked')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-gray-300/70 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.6)_3px,rgba(255,255,255,0.6)_6px)]" />{t('salesProjection.legendProjected')}</span>
          </div>
        </div>
      </section>

      {/* Method + confidence — honesty, not decoration */}
      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs leading-relaxed text-gray-600">
        <p className="font-semibold text-gray-700">{t('salesProjection.methodHeading')}</p>
        <p className="mt-1">
          {data.seasonal
            ? t('salesProjection.methodSeasonal', { completed: data.completedMonths, year: data.year, prior: data.year - 1 })
            : t('salesProjection.methodFlat', { completed: data.completedMonths })}
        </p>
        <p className="mt-1">{confText}</p>
        <p className="mt-1 italic">{t('salesProjection.disclaimer')}</p>
      </section>
    </div>
  );
}
