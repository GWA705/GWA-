import Link from 'next/link';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { geocodingConfigured } from '@/lib/leadGeo';
import { StoreLocationEditor } from './StoreLocationEditor';

export const dynamic = 'force-dynamic';

export default async function StoreLocationsPage() {
  await requireAdminSection('dealers');
  const stores = await prisma.homeDepotStore.findMany({
    where: { active: true },
    select: { id: true, number: true, name: true, latitude: true, longitude: true, dealer: { select: { name: true } } },
    orderBy: [{ dealer: { name: 'asc' } }, { number: 'asc' }],
  });
  const items = stores.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name ?? '',
    dealer: s.dealer?.name ?? '',
    lat: s.latitude,
    lng: s.longitude,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/dealers" className="text-sm text-brand-700 hover:underline">← Dealers</Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Store map locations</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Where each Home Depot sits on the Leads map. Most are placed automatically from the store
          name — pick a store and drag its marker (or paste coordinates) to correct any that landed in
          the wrong spot.
        </p>
      </div>
      {!geocodingConfigured() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Automatic placement is off (no Google key is set), so &ldquo;Auto-place&rdquo; won&apos;t work — you can
          still set any store&apos;s location by hand.
        </div>
      )}
      <StoreLocationEditor stores={items} />
    </div>
  );
}
