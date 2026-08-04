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
  financed,
  hdRequired,
}: {
  applicationId: string;
  financeItNumber: string | null;
  hdReference: string | null;
  // Whether the deal is financed — the Financing deal number is only required then.
  financed: boolean;
  // Whether this is an HD-program deal — the HD Customer # only applies then.
  hdRequired: boolean;
}) {
  const [state, action] = useFormState(setDealReferencesAction.bind(null, applicationId), {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">Saved.</div>}
      <div>
        <label className="label" htmlFor="financeItNumber">
          Financing deal number{financed ? ' *' : ' (not required — paid deal)'}
        </label>
        <input
          id="financeItNumber"
          name="financeItNumber"
          defaultValue={financeItNumber ?? ''}
          placeholder={financed ? 'e.g. finance company deal #' : 'Not required for a paid (non-finance) deal'}
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="label" htmlFor="hdReference">
          HD Customer #{hdRequired ? ' *' : ' (not required — GWA deal)'}
        </label>
        <input
          id="hdReference"
          name="hdReference"
          defaultValue={hdReference ?? ''}
          placeholder={hdRequired ? 'Home Depot customer #' : 'Not required for a GWA deal'}
          className="input text-sm"
          autoComplete="off"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          Recorded on the deal and visible to the dealer. Fields marked * are required before funding.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
