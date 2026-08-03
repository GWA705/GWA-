'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveOrderEmailAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function OrderEmailForm({ current }: { current: string }) {
  const [state, action] = useFormState(saveOrderEmailAction, {} as { ok?: boolean });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label className="label" htmlFor="orderEmail">Orders go to</label>
        <input id="orderEmail" name="orderEmail" type="email" defaultValue={current} className="input" placeholder="orders@ghsbarrie.ca" />
      </div>
      <SubmitButton />
      {state.ok && <span className="pb-2 text-xs text-green-600">Saved.</span>}
    </form>
  );
}
