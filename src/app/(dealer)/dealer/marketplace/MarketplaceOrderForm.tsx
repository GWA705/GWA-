'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createOrderAction, type OrderActionState } from './actions';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
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

export function MarketplaceOrderForm({ items }: { items: Item[] }) {
  const [state, action] = useFormState(createOrderAction, initial);

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="card flex flex-col p-4">
            <div className="font-medium text-gray-900">{item.name}</div>
            {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
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
          </div>
        ))}
      </div>

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
