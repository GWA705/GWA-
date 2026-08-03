'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveItemAction, type ItemActionState } from './actions';

interface Item {
  id: string;
  name: string;
  description: string | null;
  options: string[];
  sortOrder: number;
  active: boolean;
}

const initial: ItemActionState = {};

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add item'}
    </button>
  );
}

export function ItemForm({ item }: { item?: Item }) {
  const [state, action] = useFormState(saveItemAction, initial);
  const isEdit = !!item;

  return (
    <form action={action} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={item?.name ?? ''} className="input" />
        </div>
        <div>
          <label className="label">Options <span className="font-normal text-gray-400">(sizes, comma-separated — optional)</span></label>
          <input name="options" defaultValue={item?.options.join(', ') ?? ''} className="input" placeholder="S, M, L, XL" />
        </div>
      </div>
      <div>
        <label className="label">Description <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea name="description" defaultValue={item?.description ?? ''} rows={2} className="input" />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-28">
          <label className="label">Sort order</label>
          <input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} className="input" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="active" defaultChecked={item ? item.active : true} className="h-4 w-4" />
          Active (visible to dealers)
        </label>
        <div className="ml-auto"><SubmitButton isEdit={isEdit} /></div>
      </div>
    </form>
  );
}
