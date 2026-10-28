'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { setLeadCreditAction, type WeeklyActionState } from './actions';

export interface LeadRow {
  hdRef: string; customer: string; storeNumber: string; storeName: string;
  value: string; datePaid: string; associateName: string; associateSource: string;
}

// React 18 has no useActionState — pending comes from useFormStatus.
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function AttributeRow({ lead }: { lead: LeadRow }) {
  const [state, action] = useFormState<WeeklyActionState, FormData>(setLeadCreditAction.bind(null, lead.hdRef), {});
  const done = state?.ok || (lead.associateSource === 'ONLINE') || !!lead.associateName;

  return (
    <tr className={done && !state?.error ? '' : 'bg-amber-50/40'}>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{lead.customer}</div>
        <div className="text-xs text-gray-500">{lead.storeName} · #{lead.storeNumber} · {lead.datePaid}</div>
        <div className="mt-0.5"><span className="rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-orange-700">701 · {lead.hdRef}</span></div>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{lead.value}</td>
      <td className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-center gap-2">
          <select name="source" defaultValue={lead.associateSource || 'IN_STORE'} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            <option value="IN_STORE">In‑store associate</option>
            <option value="ONLINE">Online (homedepot.ca)</option>
          </select>
          <input name="associateName" defaultValue={lead.associateName} placeholder="Associate name" className="w-48 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" />
          <SaveButton />
          {state?.ok && <span className="text-xs text-green-600">✓ saved</span>}
          {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
