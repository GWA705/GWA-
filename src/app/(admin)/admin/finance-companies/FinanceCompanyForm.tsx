'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createFinanceCompanyAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add finance company'}
    </button>
  );
}

export function FinanceCompanyForm() {
  const [state, action] = useFormState(createFinanceCompanyAction, {} as ActionState);
  return (
    <form action={action} className="flex items-end gap-3">
      <div className="flex-1">
        <label className="label" htmlFor="name">Finance company name</label>
        <input id="name" name="name" required className="input" />
      </div>
      <SubmitButton />
      {state.error && <span className="pb-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
