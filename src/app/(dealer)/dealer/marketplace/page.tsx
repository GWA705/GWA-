import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { MarketplaceOrderForm } from './MarketplaceOrderForm';
import { PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function DealerMarketplace({ searchParams }: { searchParams: { ok?: string } }) {
  await requireDealerAccess();
  const [categories, rows] = await Promise.all([
    prisma.marketplaceCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.marketplaceItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, description: true, options: true, imageStorageKey: true, updatedAt: true, categoryId: true, kind: true, fileStorageKey: true, fileName: true, featured: true, tags: true },
    }),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    options: r.options,
    hasImage: !!r.imageStorageKey,
    imageVersion: r.updatedAt.getTime(),
    categoryId: r.categoryId,
    kind: r.kind,
    hasFile: !!r.fileStorageKey,
    fileName: r.fileName,
    featured: r.featured,
    tags: r.tags,
  }));

  return (
    <div>
      <div className="mb-5">
        <PageHeader
          variant="hero"
          icon="🛍️"
          eyebrow="Sales & rewards"
          title="Marketplace"
          subtitle="Choose what you'd like and submit an order — our team will take it from there."
        />
      </div>

      {searchParams.ok && (
        <div className="mb-5 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✓ Your order was submitted. Thanks — we&apos;ll be in touch.
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Nothing available to order right now.</div>
      ) : (
        <MarketplaceOrderForm items={items} categories={categories} />
      )}
    </div>
  );
}
