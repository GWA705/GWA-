import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { MarketplaceOrderForm } from './MarketplaceOrderForm';

export const dynamic = 'force-dynamic';

export default async function DealerMarketplace({ searchParams }: { searchParams: { ok?: string } }) {
  await requireDealerAccess();
  const items = await prisma.marketplaceItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, options: true },
  });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Marketplace</h1>
        <p className="mt-1 text-sm text-gray-500">Choose what you&apos;d like and submit an order — our team will take it from there.</p>
      </div>

      {searchParams.ok && (
        <div className="mb-5 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✓ Your order was submitted. Thanks — we&apos;ll be in touch.
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Nothing available to order right now.</div>
      ) : (
        <MarketplaceOrderForm items={items} />
      )}
    </div>
  );
}
