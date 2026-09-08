import type { ProductMixReport } from '@/lib/reporting/productMix';
import { getT } from '@/i18n/server';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function ProductMixView({ report }: { report: ProductMixReport }) {
  const t = getT();

  if (report.totalDeals === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {report.error ? t('productMix.readError', { error: report.error }) : t('productMix.noDeals')}
      </div>
    );
  }

  const top = report.products[0]?.deals ?? 1;

  return (
    <div className="space-y-5">
      {/* KPI band */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b5bd3] via-[#1a5fa8] to-[#0e2b5c] shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('productMix.totalDeals')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.totalDeals.toLocaleString('en-US')}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('productMix.avgPerDeal')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.avgProductsPerDeal}</div>
            <div className="mt-1 text-xs text-white/80">{t('productMix.avgPerDealSub')}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('productMix.distinctProducts')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.products.length}</div>
          </div>
        </div>
      </div>

      {/* Product bars */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900">{t('productMix.byProduct')}</h2>
        <p className="mb-4 text-xs text-gray-400">{t('productMix.byProductHint')}</p>
        <div className="space-y-2.5">
          {report.products.map((p) => (
            <div key={p.code}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-gray-800">{p.code}</span>
                <span className="tabular-nums text-gray-600">{p.deals} · {p.sharePct}% · {money(p.gross)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#1a5fa8]" style={{ width: `${Math.max(2, Math.round((p.deals / top) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">{t('productMix.basisNote')}</p>
    </div>
  );
}
