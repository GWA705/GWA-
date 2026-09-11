'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { ingestRemittancePdfAction, type RemittanceActionState } from './actions';

const initial: RemittanceActionState = {};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Reading PDF…' : 'Upload & process'}
    </button>
  );
}

export function UploadRemittanceForm() {
  const [state, action] = useFormState(ingestRemittancePdfAction, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="rounded-md border border-green-200 bg-green-50 p-2.5 text-sm text-green-800">✓ Processed — {state.summary}</p>}
      <p className="text-sm text-gray-500">
        Upload the Home Depot <strong>Remittance Advice</strong> PDF — the portal reads the invoices and processes it
        automatically. (The raw HD PDF has no customer names, so lines show the HD&nbsp;# and amount; each still matches
        to a deal by HD&nbsp;#.)
      </p>
      <input
        type="file"
        name="pdf"
        accept="application/pdf,.pdf"
        required
        className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />
      <SubmitBtn />
    </form>
  );
}
