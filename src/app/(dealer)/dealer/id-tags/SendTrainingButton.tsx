'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendTrainingInviteAction, type TrainingInviteState } from './actions';

function Inner({ label, small }: { label: string; small: boolean }) {
  const { pending } = useFormStatus();
  const base = small
    ? 'rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50'
    : 'rounded-lg bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50';
  return <button type="submit" disabled={pending} className={base}>{pending ? 'Sending…' : label}</button>;
}

/** One-click "email this person the Home Depot training link" from the dealer's
 *  ID-tags list (or the submit success panel). */
export function SendTrainingButton({ id, label = 'Send training email', small = false }: { id: string; label?: string; small?: boolean }) {
  const [state, action] = useFormState(sendTrainingInviteAction, {} as TrainingInviteState);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <Inner label={label} small={small} />
      {state?.error && <span className="text-[11px] text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-[11px] font-semibold text-green-700">{state.message}</span>}
    </form>
  );
}
