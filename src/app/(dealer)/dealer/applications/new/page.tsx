import { SectionHero } from '@/components/SectionHero';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { productChecklistOptions } from '@/lib/products';
import { getT } from '@/i18n/server';
import { NewApplicationForm } from './NewApplicationForm';

export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const user = await requireDealerAccess();
  const t = getT();
  const stores = user.dealerId
    ? await prisma.homeDepotStore.findMany({
        where: { dealerId: user.dealerId, active: true },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, name: true },
      })
    : [];

  const products = await productChecklistOptions(user.dealerId);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <SectionHero eyebrow={t('newApplication.heroEyebrow')} title={t('newApplication.heroTitle')} subtitle={t('newApplication.heroSubtitle')} bgImage="/new-customer-hero.webp" />
      </div>
      <NewApplicationForm stores={stores} products={products} />
    </div>
  );
}
