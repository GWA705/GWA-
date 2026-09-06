import type { ProductPricingResult, PriceStat } from '@/lib/reporting/productPricing';
import { ManualPackageBuilder } from '@/components/reporting/ManualPackageBuilder';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function StatTable({ title, blurb, rows, unitLabel, t }: { title: string; blurb: string; rows: PriceStat[]; unitLabel: string; t: TFunction }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{blurb}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">{t('productPricing.emptyStat', { unit: unitLabel })}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-4 py-3 text-left">{unitLabel}</th>
                <th className="px-4 py-3 text-right">{t('productPricing.colSales')}</th>
                <th className="px-4 py-3 text-right">{t('productPricing.colAvgNet')}</th>
                <th className="px-4 py-3 text-right">{t('productPricing.colAvgAfterTax')}</th>
                <th className="px-4 py-3 text-right">{t('productPricing.colLow')}</th>
                <th className="px-4 py-3 text-right">{t('productPricing.colHigh')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.label}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">{r.count}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">{money(r.avgNet)}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600">{money(r.avg)}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{money(r.min)}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-500">{money(r.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Presentational report: summary tiles + per-product and per-package averages. */
export function ProductPricingReport({ data, scopeLabel }: { data: ProductPricingResult; scopeLabel: string }) {
  const t = getT();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label={t('productPricing.dealsCounted')} value={String(data.dealsCounted)} sub={scopeLabel} />
        <Tile label={t('productPricing.singleUnitSales')} value={String(data.singleUnitDeals)} sub={t('productPricing.distinctProducts', { n: data.products.length })} />
        <Tile label={t('productPricing.packageSales')} value={String(data.packageDeals)} sub={t('productPricing.distinctPackages', { n: data.packages.length })} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">{t('productPricing.productsSectionTitle')}</h3>
          <p className="text-xs text-gray-500">{t('productPricing.productsSectionBlurb')}</p>
        </div>
        {data.productCounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">{t('productPricing.noProducts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">{t('productPricing.colProduct')}</th>
                  <th className="px-4 py-3 text-right">{t('productPricing.colSold')}</th>
                  <th className="px-4 py-3 text-right">{t('productPricing.colApproved')}</th>
                  <th className="px-4 py-3 text-right">{t('productPricing.colInstalled')}</th>
                </tr>
              </thead>
              <tbody>
                {data.productCounts.map((c) => (
                  <tr key={c.name} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-gray-900">{c.sold}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-green-700">{c.approved}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-blue-700">{c.installed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StatTable
        title={t('productPricing.avgByProductTitle')}
        blurb={t('productPricing.avgByProductBlurb')}
        rows={data.products}
        unitLabel={t('productPricing.unitProduct')}
        t={t}
      />

      <StatTable
        title={t('productPricing.avgByPackageTitle')}
        blurb={t('productPricing.avgByPackageBlurb')}
        rows={data.packages}
        unitLabel={t('productPricing.unitPackage')}
        t={t}
      />

      <ManualPackageBuilder deals={data.deals} products={data.allProducts} />


      <p className="px-1 text-xs text-gray-400">
        {t('productPricing.footnotePart1')}
        <strong>{t('productPricing.footnoteAfterTax')}</strong>
        {t('productPricing.footnotePart2')}
        <strong>{t('productPricing.footnoteNet')}</strong>
        {t('productPricing.footnotePart3')}
      </p>
    </div>
  );
}
