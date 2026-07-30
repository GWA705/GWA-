import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New customer processing</h1>
      <NewApplicationForm stores={stores} />
    </div>
  );
}
