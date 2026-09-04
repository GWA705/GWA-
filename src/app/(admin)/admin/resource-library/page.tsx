import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { CreateProductForm } from './CreateProductForm';
import { ProductRowActions } from './ProductRowActions';

export const dynamic = 'force-dynamic';

export default async function ResourceLibraryAdminPage() {
  await requireAdminSection('resource-library');
  const products = await prisma.resourceProduct.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      journalName: true,
      category: true,
      brand: true,
      active: true,
      imageStorageKey: true,
      updatedAt: true,
      _count: { select: { files: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resource library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Product manuals, brochures and spec sheets dealers can view and download under their Resources tab.
          </p>
        </div>
        {products.length > 0 && (
          <a href="/api/resource-products/export" className="btn-secondary shrink-0 text-sm" title="Download the product catalog as a CSV (for the booking site / other systems)">
            ↓ Export products (CSV)
          </a>
        )}
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Add a product</h2>
        <CreateProductForm />
      </div>

      {products.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-gray-900">Products</h2>
          <span className="text-xs text-gray-400">{products.length} total</span>
        </div>
      )}

      <div className="space-y-2.5">
        {products.length === 0 ? (
          <div className="card p-6 text-sm text-gray-500">No products yet. Add your first one above.</div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className={`grid grid-cols-[56px_1fr] items-center gap-4 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm transition hover:border-gray-300 sm:grid-cols-[56px_1fr_auto] ${p.active ? '' : 'opacity-70'}`}
            >
              {/* Thumbnail on a white photo tile (reads cleanly in dark mode). */}
              <div className="photo-mat flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200">
                {p.imageStorageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/resource-products/${p.id}/image?v=${p.updatedAt.getTime()}`} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-lg text-gray-300">📄</span>
                )}
              </div>

              {/* Main: brand eyebrow, title, and a meta row of chips. */}
              <div className="min-w-0">
                {p.brand && <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{p.brand}</div>}
                <Link href={`/admin/resource-library/${p.id}`} className="block truncate text-[15px] font-semibold text-gray-900 hover:underline">
                  {p.title}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {p.category && <CategoryChip category={p.category} />}
                  {p.journalName && (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
                      {p.journalName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {p._count.files} file{p._count.files === 1 ? '' : 's'}
                  </span>
                  {!p.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
                </div>
              </div>

              {/* Actions — full width under the info on mobile, inline on desktop. */}
              <div className="col-span-2 border-t border-gray-100 pt-2.5 sm:col-span-1 sm:border-0 sm:pt-0">
                <ProductRowActions id={p.id} title={p.title} active={p.active} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Category as a semantic pill — a neutral chip with a coloured dot (Air = sky,
// Water = teal), which reads correctly in both themes without extra tint rules.
function CategoryChip({ category }: { category: string }) {
  const c = category.toLowerCase();
  const color = c.includes('air') ? '#0284c7' : c.includes('water') ? '#0d9488' : '#64748b';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {category}
    </span>
  );
}
