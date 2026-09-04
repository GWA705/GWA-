import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { MarketplaceOrderForm } from './MarketplaceOrderForm';
import { SectionHero } from '@/components/SectionHero';
import { Shirt, Presentation, Gift, Package } from 'lucide-react';

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
    <div className="space-y-5">
      <SectionHero
        eyebrow="Sales & rewards"
        title="Marketplace"
        subtitle="High-quality branded products to help you grow your business."
        bgImage="/marketplace-hero.jpg"
        tiles={[
          { Icon: Shirt, title: 'Professional apparel' },
          { Icon: Presentation, title: 'Marketing signage' },
          { Icon: Gift, title: 'Promotional items' },
          { Icon: Package, title: 'Sample kits & more' },
        ]}
        flourish={['Represent', 'Grow', 'Succeed', 'Together']}
      />

      {searchParams.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
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
