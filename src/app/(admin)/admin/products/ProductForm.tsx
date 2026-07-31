'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createProductAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add product'}
    </button>
  );
}

export function ProductForm() {
  const [state, action] = useFormState(createProductAction, {} as ActionState);
  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="label" htmlFor="name">Product name</label>
        <input id="name" name="name" required className="input" placeholder="e.g. UV12" />
      </div>
      <SubmitButton />
      {state.error && <span className="pb-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
