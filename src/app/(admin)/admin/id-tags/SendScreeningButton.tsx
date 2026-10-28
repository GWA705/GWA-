'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendIdTagScreeningEmailAdminAction, type ScreeningEmailState } from './actions';

function Submit({ resend, disabled }: { resend: boolean; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? 'No email on file for this rep' : undefined}
      className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Sending…' : resend ? '✉ Resend screening' : '✉ Send screening email'}
    </button>
  );
}

/**
 * Per-row button on the ID-tag board: send the new rep their background-check /
 * Entuitive intro email, after the reviewer has set them up in Entuitive. Shows
 * when it was last sent so nobody double-sends.
 */
export function SendScreeningButton({
  id, hasEmail, sentAtLabel,
}: {
  id: string;
  hasEmail: boolean;
  sentAtLabel: string | null;
}) {
  const [state, action] = useFormState(sendIdTagScreeningEmailAdminAction, {} as ScreeningEmailState);

  if (state.ok) {
    return <span className="text-xs font-semibold text-green-700" title={state.message}>✓ Sent</span>;
  }

  return (
    <form action={action} className="flex flex-col items-start gap-0.5">
      <input type="hidden" name="id" value={id} />
      <Submit resend={!!sentAtLabel} disabled={!hasEmail} />
      {sentAtLabel && <span className="text-[10px] text-slate-400">sent {sentAtLabel}</span>}
      {state.error && <span className="max-w-[180px] text-[10px] text-red-600">{state.error}</span>}
    </form>
  );
}
