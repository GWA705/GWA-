'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createOrderAction, type OrderActionState } from './actions';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
  hasImage: boolean;
  categoryId: string | null;
  kind: string;
  hasFile: boolean;
  fileName: string | null;
}

interface Category {
  id: string;
  name: string;
}

const initial: OrderActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Submitting…' : 'Submit order'}
    </button>
  );
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="card flex flex-col overflow-hidden p-0">
      {item.hasImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={`/api/marketplace/items/${item.id}/image`} alt={item.name} className="aspect-square w-full bg-gray-50 object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gray-50 text-4xl text-gray-300" aria-hidden>👕</div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="font-medium text-gray-900">{item.name}</div>
        {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
        {item.kind === 'DOWNLOAD' ? (
          <div className="mt-auto pt-4">
            {item.hasFile ? (
              <a
                href={`/api/marketplace/items/${item.id}/file`}
                className="btn-primary inline-flex w-full items-center justify-center gap-2"
              >
                ⬇ Download{item.fileName ? '' : ' file'}
              </a>
            ) : (
              <p className="text-sm text-gray-400">Coming soon</p>
            )}
          </div>
        ) : (
          <div className="mt-auto flex items-end gap-2 pt-4">
            {item.options.length > 0 && (
              <div className="flex-1">
                <label className="label" htmlFor={`opt_${item.id}`}>Option</label>
                <select id={`opt_${item.id}`} name={`opt_${item.id}`} className="input">
                  {item.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="w-20">
              <label className="label" htmlFor={`qty_${item.id}`}>Qty</label>
              <input id={`qty_${item.id}`} name={`qty_${item.id}`} type="number" min="0" defaultValue={0} className="input" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function MarketplaceOrderForm({ items, categories }: { items: Item[]; categories: Category[] }) {
  const [state, action] = useFormState(createOrderAction, initial);

  // Group items under their category (in the admin-defined order). Items with no
  // category — or whose category is hidden — fall into an "Other" section.
  const activeIds = new Set(categories.map((c) => c.id));
  const sections = categories
    .map((c) => ({ name: c.name, items: items.filter((it) => it.categoryId === c.id) }))
    .filter((s) => s.items.length > 0);
  const other = items.filter((it) => !it.categoryId || !activeIds.has(it.categoryId));
  const useHeadings = sections.length > 0;

  return (
    <form action={action} className="space-y-8">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      {useHeadings ? (
        <>
          {sections.map((s) => (
            <section key={s.name} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{s.name}</h2>
              <ItemGrid items={s.items} />
            </section>
          ))}
          {other.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Other</h2>
              <ItemGrid items={other} />
            </section>
          )}
        </>
      ) : (
        <ItemGrid items={items} />
      )}

      <div className="card p-4">
        <label className="label" htmlFor="note">Note <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea id="note" name="note" rows={3} className="input" placeholder="Anything the fulfillment team should know…" />
      </div>

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
