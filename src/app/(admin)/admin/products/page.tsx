import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { journalCodeFromName } from '@/lib/journalCode';
import { ProductForm } from './ProductForm';
import { ProductRowActions } from './ProductRowActions';
import { DealerProductRow } from './DealerProductRow';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  await requireAdminSection('products');
  const [products, dealerProducts] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.dealerCustomProduct.findMany({
      orderBy: [{ dealer: { name: 'asc' } }, { name: 'asc' }],
      include: { dealer: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <p className="mt-1 text-sm text-gray-500">
          These power the “Product(s) sold” picker dealers use on a deal. The <strong>full name</strong> shows
          in the app; the <strong>journal name</strong> (short code) is what gets written to the sales journal.
          Use the arrows to set the order dealers see. Add, rename, archive, or delete anytime.
        </p>
      </div>
      <div className="card p-6">
        <ProductForm />
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 w-10">Order</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Journal name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No products yet.</td></tr>
            ) : (
              products.map((p, i) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    {p.journalName
                      ? <span className="badge bg-brand-50 font-mono text-brand-700">{p.journalName}</span>
                      : <span className="text-xs text-gray-400">— uses full name</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {p.active ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ProductRowActions
                      id={p.id}
                      name={p.name}
                      journalName={p.journalName}
                      active={p.active}
                      isFirst={i === 0}
                      isLast={i === products.length - 1}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dealer-added products — auto first-letters code; admin sets the final. */}
      <div>
        <h2 className="text-base font-semibold text-gray-900">Dealer-added products</h2>
        <p className="mt-1 text-sm text-gray-500">
          Products dealers added to their own lists. They arrive with an auto code (first letter of each word) —
          set the <strong>final journal code</strong> here. These stay on that dealer&apos;s picker only.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Journal code</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dealerProducts.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No dealer-added products yet.</td></tr>
            ) : (
              dealerProducts.map((p) => (
                <DealerProductRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  dealerName={p.dealer?.name ?? '—'}
                  journalName={p.journalName}
                  suggested={journalCodeFromName(p.name)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
