import type { ProductPricingResult, PriceStat } from '@/lib/reporting/productPricing';
import { ManualPackageBuilder } from '@/components/reporting/ManualPackageBuilder';

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

function StatTable({ title, blurb, rows, unitLabel }: { title: string; blurb: string; rows: PriceStat[]; unitLabel: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{blurb}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">No {unitLabel} sales in this range yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-4 py-3 text-left">{unitLabel}</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Avg net</th>
                <th className="px-4 py-3 text-right">Avg after-tax</th>
                <th className="px-4 py-3 text-right">Low</th>
                <th className="px-4 py-3 text-right">High</th>
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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Deals counted" value={String(data.dealsCounted)} sub={scopeLabel} />
        <Tile label="Single-unit sales" value={String(data.singleUnitDeals)} sub={`${data.products.length} distinct products`} />
        <Tile label="Package sales" value={String(data.packageDeals)} sub={`${data.packages.length} distinct packages`} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">Products — sold, approved &amp; installed</h3>
          <p className="text-xs text-gray-500">Units by product across all deals (one per product per deal). Installed = deals whose installation date has been reached.</p>
        </div>
        {data.productCounts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Sold</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                  <th className="px-4 py-3 text-right">Installed</th>
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
        title="Average price by product"
        blurb="Stand-alone sales — deals where a single product was sold."
        rows={data.products}
        unitLabel="Product"
      />

      <StatTable
        title="Average price by package"
        blurb="Deals where two or more products were sold together, grouped by the exact combination."
        rows={data.packages}
        unitLabel="Package"
      />

      <ManualPackageBuilder deals={data.deals} products={data.allProducts} />


      <p className="px-1 text-xs text-gray-400">
        Averages use approved deals (approved amount, falling back to requested). <strong>After-tax</strong> is the full sale
        total; <strong>net</strong> backs the tax out using the deal&rsquo;s province rate. A deal with one product counts
        toward that product&rsquo;s average; two or more counts as a package.
      </p>
    </div>
  );
}
