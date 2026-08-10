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
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="label" htmlFor="name">Product name</label>
        <input id="name" name="name" required className="input" placeholder="e.g. Ultraviolet Sanitizer 12" />
      </div>
      <div className="sm:w-48">
        <label className="label" htmlFor="journalName">Journal name</label>
        <input id="journalName" name="journalName" maxLength={40} className="input" placeholder="e.g. UV12" />
        <p className="mt-1 text-xs text-gray-400">Short code written to the journal. Optional — the full name is used if blank.</p>
      </div>
      <SubmitButton />
      {state.error && <span className="pb-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
