'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveBillingRatesAction } from '@/app/(admin)/actions';
import type { ActionState } from '@/app/(admin)/actions';

function SaveBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? 'Saving…' : 'Save rates'}</button>;
}

export function BillingRatesForm({ leadRate, envelopeRate, hstPercent }: { leadRate: number; envelopeRate: number; hstPercent: number }) {
  const [state, action] = useFormState(saveBillingRatesAction, {} as ActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-green-700">{state.message}</p>}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Per lead ($)</span>
        <input name="leadRate" type="number" step="0.01" min={0} defaultValue={leadRate} className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Per envelope ($)</span>
        <input name="envelopeRate" type="number" step="0.01" min={0} defaultValue={envelopeRate} className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">HST (%)</span>
        <input name="hstPercent" type="number" step="0.01" min={0} defaultValue={hstPercent} className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <SaveBtn />
    </form>
  );
}
