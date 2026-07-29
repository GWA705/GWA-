'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { recordDecisionAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Record decision'}
    </button>
  );
}

export function DecisionForm({
  applicationId,
  options,
  financeCompanies,
  defaultAmount,
}: {
  applicationId: string;
  options: { value: string; label: string }[];
  financeCompanies: { id: string; name: string }[];
  defaultAmount: string;
}) {
  const [state, action] = useFormState(recordDecisionAction, {} as ActionState);
  const [type, setType] = useState(options[0]?.value ?? '');
  const isApproval = type === 'APPROVE' || type === 'CONDITIONAL';

  if (options.length === 0) {
    return <p className="text-sm text-gray-500">Use “Change status” below to update this deal.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{state.error}</div>
      )}
      {state.ok && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">Decision recorded.</div>
      )}
      <input type="hidden" name="applicationId" value={applicationId} />
      <div>
        <label className="label" htmlFor="type">Decision</label>
        <select id="type" name="type" required className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isApproval && (
        <div className="space-y-3 rounded-md bg-green-50/50 p-3 ring-1 ring-green-100">
          <div>
            <label className="label" htmlFor="approvedAmount">Approved amount (CAD)</label>
            <input id="approvedAmount" name="approvedAmount" type="number" step="0.01" min="0" defaultValue={defaultAmount} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="financeCompanyId">Finance company</label>
            <select id="financeCompanyId" name="financeCompanyId" className="input">
              <option value="">Select…</option>
              {financeCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">Notes (shared with dealer)</label>
        <textarea id="notes" name="notes" rows={3} className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
