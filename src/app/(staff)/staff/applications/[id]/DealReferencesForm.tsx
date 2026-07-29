'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setDealReferencesAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function DealReferencesForm({
  applicationId,
  financeItNumber,
  hdReference,
}: {
  applicationId: string;
  financeItNumber: string | null;
  hdReference: string | null;
}) {
  const [state, action] = useFormState(setDealReferencesAction.bind(null, applicationId), {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">Saved.</div>}
      <div>
        <label className="label" htmlFor="financeItNumber">Financing deal number</label>
        <input
          id="financeItNumber"
          name="financeItNumber"
          defaultValue={financeItNumber ?? ''}
          placeholder="e.g. finance company deal #"
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="label" htmlFor="hdReference">HD Customer #</label>
        <input
          id="hdReference"
          name="hdReference"
          defaultValue={hdReference ?? ''}
          placeholder="Home Depot customer #"
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">Recorded on the deal and visible to the dealer.</p>
        <SubmitButton />
      </div>
    </form>
  );
}
