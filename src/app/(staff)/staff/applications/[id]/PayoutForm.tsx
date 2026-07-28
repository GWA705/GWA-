'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { recordPayoutAction, type ActionState } from '@/app/(staff)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm" disabled={pending}>
      {pending ? 'Saving…' : 'Record payout'}
    </button>
  );
}

export function PayoutForm({ applicationId }: { applicationId: string }) {
  const [state, action] = useFormState(recordPayoutAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Payout recorded.</div>}
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="amount">Amount paid (CAD)</label><input id="amount" name="amount" type="number" step="0.01" min="0" required className="input" /></div>
        <div><label className="label" htmlFor="paidOn">Date paid</label><input id="paidOn" name="paidOn" type="date" required className="input" /></div>
        <div><label className="label" htmlFor="method">Method</label><input id="method" name="method" className="input" placeholder="EFT, cheque…" /></div>
        <div><label className="label" htmlFor="reference">Reference #</label><input id="reference" name="reference" className="input" /></div>
      </div>
      <div><label className="label" htmlFor="note">Note</label><input id="note" name="note" className="input" /></div>
      <SubmitButton />
    </form>
  );
}
