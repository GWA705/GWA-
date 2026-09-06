import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { MarketplaceOrderForm } from './MarketplaceOrderForm';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';
import { Shirt, Presentation, Gift, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DealerMarketplace({ searchParams }: { searchParams: { ok?: string } }) {
  await requireDealerAccess();
  const t = getT();
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
        title={t('marketplace.heroTitle')}
        subtitle={t('marketplace.heroSubtitle')}
        bgImage="/marketplace-hero.png"
        tiles={[
          { Icon: Shirt, title: t('marketplace.tileApparel') },
          { Icon: Presentation, title: t('marketplace.tileSignage') },
          { Icon: Gift, title: t('marketplace.tilePromo') },
          { Icon: Package, title: t('marketplace.tileSamples') },
        ]}
      />

      {searchParams.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {t('marketplace.orderSubmitted')}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">{t('marketplace.nothingAvailable')}</div>
      ) : (
        <MarketplaceOrderForm items={items} categories={categories} />
      )}
    </div>
  );
}
