import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DealerResourceLibraryPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string };
}) {
  await requireDealerAccess();

  const q = (searchParams.q ?? '').trim();
  const cat = (searchParams.cat ?? '').trim();

  const products = await prisma.resourceProduct.findMany({
    where: {
      active: true,
      ...(cat ? { category: cat } : {}),
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
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
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

  // Categories for the filter chips (from active products).
  const cats = await prisma.resourceProduct.findMany({
    where: { active: true, category: { not: null } },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  const categories = cats.map((c) => c.category!).filter(Boolean);

  const chip = (label: string, value: string) => {
    const active = cat === value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (value) params.set('cat', value);
    const href = `/dealer/resources/library${params.toString() ? `?${params}` : ''}`;
    return (
      <Link
        key={value || 'all'}
        href={href}
        className={`rounded-full px-3 py-1 text-sm font-medium transition ${active ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {label}
      </Link>
    );
  };

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
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chip('All', '')}
          {categories.map((c) => chip(c, c))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          {q || cat ? 'No products match your search.' : 'No products have been added yet. Check back soon.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/dealer/resources/library/${p.id}`}
              className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-gray-300 hover:shadow-sm"
            >
              <div className="aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
                {p.imageStorageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/resource-products/${p.id}/image?v=${p.updatedAt.getTime()}`}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-2 transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">📄</div>
                )}
              </div>
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-semibold text-gray-900">{p.title}</div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {[p.brand, p.category].filter(Boolean).join(' · ') || ' '}
                </div>
                <div className="mt-1 text-[11px] text-sky-600">
                  {p._count.files} file{p._count.files === 1 ? '' : 's'} →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
