'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendIdTagScreeningEmailStaffAction, type ScreeningEmailState } from '../actions';

function Submit({ resend, disabled }: { resend: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Sending…' : resend ? 'Resend background-check email' : 'Send background-check email'}
    </button>
  );
}

/**
 * Reviewer button: send the new rep their background-check / Entuitive intro
 * email. Pressed after the rep has been set up in Entuitive — nothing sends on
 * its own. Shows when it was last sent so nobody double-sends by accident.
 */
export function SendScreeningButton({
  id, hasEmail, sentAtLabel,
}: {
  id: string;
  hasEmail: boolean;
  sentAtLabel: string | null;
}) {
  const [state, action] = useFormState(sendIdTagScreeningEmailStaffAction, {} as ScreeningEmailState);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit resend={!!sentAtLabel} disabled={!hasEmail} />
        {sentAtLabel && !state.ok && (
          <span className="text-xs text-slate-500">Last sent {sentAtLabel}</span>
        )}
      </div>
      {!hasEmail && (
        <p className="text-xs font-medium text-amber-700">No email on file for this rep — add one on the dealer’s submission first.</p>
      )}
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.ok && <p className="text-sm font-medium text-green-700">✓ {state.message}</p>}
    </form>
  );
}
