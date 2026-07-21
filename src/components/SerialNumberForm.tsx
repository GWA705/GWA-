'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { ActionState } from '@/app/(dealer)/actions';

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Adding…' : 'Add'}
    </button>
  );
}

export function SerialNumberForm({ action }: { action: BoundAction }) {
  const [state, formAction] = useFormState(action, {} as ActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label text-xs">Serial number</label>
        <input name="value" required className="input py-1 text-sm" />
      </div>
      <div>
        <label className="label text-xs">Product (optional)</label>
        <input name="productLabel" className="input py-1 text-sm" placeholder="e.g. Furnace" />
      </div>
      <SubmitButton />
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
