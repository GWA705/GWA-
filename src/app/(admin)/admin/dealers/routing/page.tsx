import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { StoreRoutingEditor } from './StoreRoutingEditor';

export const dynamic = 'force-dynamic';

export default async function StoreRoutingPage() {
  await requireAdminSection('dealers');

  const [dealers, stores] = await Promise.all([
    prisma.dealer.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.homeDepotStore.findMany({
      select: { id: true, number: true, name: true, active: true, dealerId: true, dealer: { select: { name: true } } },
      orderBy: [{ dealer: { name: 'asc' } }, { number: 'asc' }],
    }),
  ]);

  const storeItems = stores.map((s) => ({
    id: s.id,
    number: s.number,
    city: s.name ?? '',
    active: s.active,
    dealerId: s.dealerId,
    dealerName: s.dealer?.name ?? '—',
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/dealers" className="text-sm text-brand-700 hover:underline">← Dealers</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Store routing</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Which office each Home Depot store’s <strong>leads</strong> go to. Lead attribution is live, so moving a store
          to a different dealer moves <strong>all</strong> of that store’s leads — past and future — to the new dealer at
          once. No per-lead migration needed.
        </p>
      </div>

      <StoreRoutingEditor dealers={dealers} stores={storeItems} />
    </div>
  );
}
