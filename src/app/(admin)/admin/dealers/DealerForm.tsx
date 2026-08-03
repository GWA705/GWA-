'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createDealerAction, type ActionState } from '@/app/(admin)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Adding…' : 'Add dealer'}
    </button>
  );
}

export function DealerForm() {
  const [state, action] = useFormState(createDealerAction, {} as ActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[180px] flex-1">
        <label className="label" htmlFor="name">Dealer name</label>
        <input id="name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="type">Type</label>
        <select id="type" name="type" className="input" defaultValue="DEALER">
          <option value="DEALER">Dealer</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
      </div>
      <SubmitButton />
      {state.error && <span className="pb-2 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
