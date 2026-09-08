import type { FinancePenetrationReport, FinanceGroup } from '@/lib/reporting/financePenetration';
import { getT } from '@/i18n/server';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

const GROUP_COLOR: Record<FinanceGroup, string> = {
  financed: 'bg-[#F96302]',
  cash: 'bg-emerald-500',
  other: 'bg-slate-400',
};

export function FinanceReportView({ report }: { report: FinancePenetrationReport }) {
  const t = getT();

  if (report.totalCount === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {report.error
          ? t('financeReport.readError', { error: report.error })
          : t('financeReport.noDeals')}
      </div>
    );
  }

  const pct = report.penetrationPct ?? 0;

  return (
    <div className="space-y-5">
      {/* Penetration KPI band */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#E0550A] via-[#F96302] to-[#D24E05] shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('financeReport.penetration')}</div>
            <div className="text-4xl font-extrabold leading-none text-white [text-shadow:0_1px_2px_rgba(120,40,0,0.28)]">{pct}%</div>
            <div className="mt-1 text-xs text-white/80">{t('financeReport.financedOfTotal', { financed: report.financedCount, total: report.totalCount })}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('financeReport.financedVolume')}</div>
            <div className="text-2xl font-extrabold leading-none text-white">{money(report.financedGross)}</div>
            <div className="mt-1 text-xs text-white/80">{t('financeReport.ofTotalVolume', { total: money(report.totalGross) })}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('financeReport.cashDeals')}</div>
            <div className="text-2xl font-extrabold leading-none text-white">{report.cashCount}</div>
            <div className="mt-1 text-xs text-white/80">{t('financeReport.paidOutright')}</div>
          </div>
        </div>
      </div>

      {/* Payment-method breakdown */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{t('financeReport.howPaid')}</h2>
        <div className="space-y-2.5">
          {report.buckets.map((b) => {
            const share = report.totalCount > 0 ? Math.round((b.count / report.totalCount) * 100) : 0;
            return (
              <div key={b.bucket}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-gray-800">
                    {b.bucket} <span className="text-xs font-normal text-gray-400">· {t(`financeReport.group.${b.group}`)}</span>
                  </span>
                  <span className="tabular-nums text-gray-600">{b.count} · {money(b.gross)} · {share}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full rounded-full ${GROUP_COLOR[b.group]}`} style={{ width: `${Math.max(2, share)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-store penetration */}
      {report.byStore.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">{t('financeReport.colStore')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('financeReport.colDeals')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('financeReport.colFinanced')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('financeReport.colPenetration')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('financeReport.colVolume')}</th>
                </tr>
              </thead>
              <tbody>
                {report.byStore.map((r) => (
                  <tr key={r.store} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-left font-semibold text-gray-900">{r.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.total}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.financed}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900">{r.pct === null ? '—' : `${r.pct}%`}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-800">{money(r.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">{t('financeReport.basisNote')}</p>
    </div>
  );
}
