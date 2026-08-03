import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { ItemForm } from './ItemForm';
import { ItemRowActions } from './ItemRowActions';
import { OrderEmailForm } from './OrderEmailForm';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplace() {
  await requireRole('ADMIN');

  const [orderEmail, items, orders] = await Promise.all([
    getSetting(MARKETPLACE_SETTING_KEYS.orderEmail),
    prisma.marketplaceItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { dealer: { select: { name: true } }, createdBy: { select: { name: true } }, items: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Marketplace</h1>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Where orders go</h2>
        <p className="mb-3 text-sm text-gray-500">The email that receives each order. Leave blank to email all admins.</p>
        <OrderEmailForm current={orderEmail ?? ''} />
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Add an item</h2>
        <ItemForm />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Items</h2>
        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No items yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className={`card p-4 ${item.active ? '' : 'bg-gray-50/60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {!item.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
                      {item.options.length > 0 && <span className="badge bg-brand-50 text-brand-700">{item.options.join(' · ')}</span>}
                    </div>
                    {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
                  </div>
                  <ItemRowActions id={item.id} active={item.active} />
                </div>
                <details className="mt-3 border-t border-gray-100 pt-3">
                  <summary className="cursor-pointer text-sm font-medium text-brand-700">Edit</summary>
                  <div className="mt-3"><ItemForm item={item} /></div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Recent orders</h2>
        {orders.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No orders yet.</div>
        ) : (
          <div className="card divide-y divide-gray-100">
            {orders.map((o) => (
              <div key={o.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{o.dealer.name}</span>
                  <span className="text-xs text-gray-500">{o.createdBy.name} · {o.createdAt.toLocaleString('en-CA')}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                  {o.items.map((li) => (
                    <li key={li.id}>{li.quantity} × {li.itemName}{li.option ? ` — ${li.option}` : ''}</li>
                  ))}
                </ul>
                {o.note && <p className="mt-2 text-sm text-gray-500"><span className="font-medium">Note:</span> {o.note}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
