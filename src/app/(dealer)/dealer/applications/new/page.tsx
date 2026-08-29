import { PageHeader } from '@/components/PageHeader';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { productChecklistOptions } from '@/lib/products';
import { NewApplicationForm } from './NewApplicationForm';

export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const user = await requireDealerAccess();
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
        <PageHeader eyebrow="Deals" title="New customer processing" />
      </div>
      <NewApplicationForm stores={stores} products={products} />
    </div>
  );
}
