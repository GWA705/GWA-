import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { ItemForm } from './ItemForm';
import { ItemRowActions } from './ItemRowActions';
import { OrderEmailForm } from './OrderEmailForm';
import { CategoryForm } from './CategoryForm';
import { CategoryRowActions } from './CategoryRowActions';

export const dynamic = 'force-dynamic';

export default async function AdminMarketplace() {
  await requireRole('ADMIN');

  const [orderEmail, categories, items, orders] = await Promise.all([
    getSetting(MARKETPLACE_SETTING_KEYS.orderEmail),
    prisma.marketplaceCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.marketplaceItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { dealer: { select: { name: true } }, createdBy: { select: { name: true } }, items: true },
    }),
  ]);

  // Options offered in each item's category dropdown.
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  // Group items for display: each category in sort order, then any uncategorized
  // items last. A category with no items still shows (so it's easy to file into).
  const groups: { key: string; name: string; items: typeof items }[] = categories.map((c) => ({
    key: c.id,
    name: c.active ? c.name : `${c.name} (hidden)`,
    items: items.filter((it) => it.categoryId === c.id),
  }));
  const uncategorized = items.filter((it) => !it.categoryId || !categoryName.has(it.categoryId));
  if (uncategorized.length > 0) groups.push({ key: '__none__', name: 'Uncategorized', items: uncategorized });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Marketplace</h1>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Where orders go</h2>
        <p className="mb-3 text-sm text-gray-500">The email that receives each order. Leave blank to email all admins.</p>
        <OrderEmailForm current={orderEmail ?? ''} />
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Categories</h2>
        <p className="mb-3 text-sm text-gray-500">Group items so dealers can find them. Add as many as you like; lower “sort” numbers show first.</p>
        {categories.length > 0 && (
          <div className="mb-4 space-y-2">
            {categories.map((c) => (
              <div key={c.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-100 p-2 ${c.active ? '' : 'bg-gray-50/60'}`}>
                <div className="min-w-[12rem] flex-1">
                  <CategoryForm category={{ id: c.id, name: c.name, sortOrder: c.sortOrder }} />
                </div>
                <div className="flex items-center gap-2">
                  {!c.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
                  <CategoryRowActions id={c.id} active={c.active} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-gray-100 pt-3">
          <CategoryForm />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Add an item</h2>
        <ItemForm categories={categoryOptions} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Items</h2>
        {items.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No items yet.</div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {group.name} <span className="font-normal normal-case text-gray-400">· {group.items.length}</span>
                </h3>
                {group.items.length === 0 ? (
                  <div className="card p-4 text-center text-xs text-gray-400">No items in this category yet.</div>
                ) : (
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <div key={item.id} className={`card p-4 ${item.active ? '' : 'bg-gray-50/60'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {item.imageStorageKey && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={`/api/marketplace/items/${item.id}/image`} alt="" className="h-14 w-14 shrink-0 rounded object-cover ring-1 ring-gray-200" />
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">{item.name}</span>
                                {!item.active && <span className="badge bg-gray-100 text-gray-600">Hidden</span>}
                                {item.options.length > 0 && <span className="badge bg-brand-50 text-brand-700">{item.options.join(' · ')}</span>}
                              </div>
                              {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
                            </div>
                          </div>
                          <ItemRowActions id={item.id} active={item.active} />
                        </div>
                        <details className="mt-3 border-t border-gray-100 pt-3">
                          <summary className="cursor-pointer text-sm font-medium text-brand-700">Edit</summary>
                          <div className="mt-3">
                            <ItemForm
                              categories={categoryOptions}
                              item={{
                                id: item.id,
                                name: item.name,
                                description: item.description,
                                options: item.options,
                                sortOrder: item.sortOrder,
                                active: item.active,
                                hasImage: !!item.imageStorageKey,
                                categoryId: item.categoryId,
                              }}
                            />
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
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
