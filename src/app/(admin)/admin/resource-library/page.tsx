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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Resource library</h1>
        <p className="mt-1 text-sm text-gray-600">
          Product manuals, brochures and spec sheets dealers can view and download under their Resources tab.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Add a product</h2>
        <CreateProductForm />
      </div>

      <div className="card divide-y divide-gray-100">
        {products.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No products yet. Add your first one above.</div>
        ) : (
          products.map((p) => (
            <div key={p.id} className={`flex items-center gap-4 p-4 ${p.active ? '' : 'bg-gray-50/60'}`}>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                {p.imageStorageKey && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/resource-products/${p.id}/image?v=${p.updatedAt.getTime()}`} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/resource-library/${p.id}`} className="font-medium text-gray-900 hover:underline">
                  {p.title}
                </Link>
                <div className="text-xs text-gray-500">
                  {[p.brand, p.category].filter(Boolean).join(' · ') || '—'} · {p._count.files} file{p._count.files === 1 ? '' : 's'}
                </div>
                {p.journalName && <div className="text-xs text-gray-400">Journal: <span className="font-medium text-gray-600">{p.journalName}</span></div>}
              </div>
              {!p.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
              <ProductRowActions id={p.id} title={p.title} active={p.active} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
