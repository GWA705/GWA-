'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setFinancingNumberAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function FinancingNumberForm({
  applicationId,
  current,
}: {
  applicationId: string;
  current: string | null;
}) {
  const [state, action] = useFormState(setFinancingNumberAction.bind(null, applicationId), {} as ActionState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">Saved.</div>}
      <div className="flex items-center gap-2">
        <input
          name="financeItNumber"
          defaultValue={current ?? ''}
          placeholder="e.g. finance company deal #"
          className="input text-sm"
          autoComplete="off"
        />
        <SubmitButton />
      </div>
      <p className="text-xs text-gray-400">Recorded on the deal and visible to the dealer.</p>
    </form>
  );
}
