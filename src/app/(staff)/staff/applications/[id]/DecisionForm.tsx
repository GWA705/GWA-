'use client';

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
}: {
  applicationId: string;
  options: { value: string; label: string }[];
}) {
  const [state, action] = useFormState(recordDecisionAction, {} as ActionState);

  if (options.length === 0) {
    return <p className="text-sm text-gray-500">No decisions available for this status.</p>;
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
        <select id="type" name="type" required className="input">
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="notes">Notes (shared with dealer)</label>
        <textarea id="notes" name="notes" rows={3} className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
