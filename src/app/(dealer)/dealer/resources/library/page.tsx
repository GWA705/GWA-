import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { LibraryFilters } from './LibraryFilters';

export const dynamic = 'force-dynamic';

export default async function DealerResourceLibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; brand?: string; sort?: string };
}) {
  await requireDealerAccess();

  const q = (searchParams.q ?? '').trim();
  const cat = (searchParams.cat ?? '').trim();
  const brand = (searchParams.brand ?? '').trim();
  const sort = (searchParams.sort ?? '').trim();

  const orderBy: Prisma.ResourceProductOrderByWithRelationInput[] =
    sort === 'name'
      ? [{ title: 'asc' }]
      : sort === 'brand'
        ? [{ brand: 'asc' }, { title: 'asc' }]
        : [{ sortOrder: 'asc' }, { title: 'asc' }];

  const products = await prisma.resourceProduct.findMany({
    where: {
      active: true,
      ...(cat ? { category: cat } : {}),
      ...(brand ? { brand } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
              { modelNumber: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy,
    select: {
      id: true,
      title: true,
      brand: true,
      category: true,
      imageStorageKey: true,
      updatedAt: true,
      _count: { select: { files: true } },
    },
  });

  // Category + brand facets for the filters (from active products).
  const [cats, brandRows] = await Promise.all([
    prisma.resourceProduct.findMany({
      where: { active: true, category: { not: null } },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
    prisma.resourceProduct.findMany({
      where: { active: true, brand: { not: null } },
      distinct: ['brand'],
      select: { brand: true },
      orderBy: { brand: 'asc' },
    }),
  ]);
  const categories = cats.map((c) => c.category!).filter(Boolean);
  const brands = brandRows.map((b) => b.brand!).filter(Boolean);

  const chip = (label: string, value: string) => {
    const active = cat === value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (value) params.set('cat', value);
    if (brand) params.set('brand', brand);
    if (sort) params.set('sort', sort);
    const href = `/dealer/resources/library${params.toString() ? `?${params}` : ''}`;
    return (
      <Link
        key={value || 'all'}
        href={href}
        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
          active
            ? 'bg-slate-800 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {label}
      </Link>
    );
  };

  const hasFilters = !!(q || cat || brand);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dealer/resources" className="text-sm text-gray-500 hover:underline">← Resources</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Product manuals &amp; brochures</h1>
        <p className="mt-1 text-sm text-gray-600">Find product info, manuals, brochures and spec sheets. View or download.</p>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search products, brands, models…"
          className="input flex-1"
        />
        {cat && <input type="hidden" name="cat" value={cat} />}
        {brand && <input type="hidden" name="brand" value={brand} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {/* Category chips on the left, brand + sort controls on the right. */}
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {chip('All', '')}
            {categories.map((c) => chip(c, c))}
          </div>
        ) : (
          <span />
        )}
        <LibraryFilters brands={brands} q={q} cat={cat} brand={brand} sort={sort} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {products.length} product{products.length === 1 ? '' : 's'}
          {brand && <> · <span className="font-medium text-gray-500">{brand}</span></>}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
          {hasFilters ? 'No products match your search.' : 'No products have been added yet. Check back soon.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/dealer/resources/library/${p.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
            >
              <div className="photo-mat relative aspect-[4/3] w-full overflow-hidden">
                {p.imageStorageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/resource-products/${p.id}/image?v=${p.updatedAt.getTime()}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">📄</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {p.brand && (
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">{p.brand}</div>
                )}
                <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{p.title}</h3>
                {p.category && <p className="mt-0.5 text-xs text-gray-500">{p.category}</p>}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {p._count.files} file{p._count.files === 1 ? '' : 's'}
                  </span>
                  <span className="text-[12px] font-semibold text-brand-700 transition group-hover:translate-x-0.5">View →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
