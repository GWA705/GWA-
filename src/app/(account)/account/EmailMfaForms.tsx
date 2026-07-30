'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { beginEmailMfaAction, confirmEmailMfaAction, type ActionState } from '@/app/(account)/actions';

function Pending({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/** Button that starts email-code 2FA enrollment (emails the first code). */
export function StartEmailMfaButton() {
  const [state, action] = useFormState(beginEmailMfaAction, {} as ActionState);
  return (
    <form action={action} className="space-y-2">
      <Pending label="Use email codes" busy="Sending…" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Verifying…' : 'Confirm & enable'}
    </button>
  );
}

/** Confirm the emailed code to enable email 2FA, with a resend option. */
export function ConfirmEmailMfaForm() {
  const [state, action] = useFormState(confirmEmailMfaAction, {} as ActionState);
  const [resend, resendAction] = useFormState(beginEmailMfaAction, {} as ActionState);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
        <div>
          <label className="label" htmlFor="token">Enter the 6-digit code we emailed you</label>
          <input id="token" name="token" inputMode="numeric" maxLength={6} required className="input w-40 tracking-widest" placeholder="123456" />
        </div>
        <ConfirmButton />
      </form>
      <form action={resendAction}>
        <button type="submit" className="text-xs text-brand-700 hover:underline">Resend code</button>
        {resend.ok && <span className="ml-2 text-xs text-green-700">New code sent.</span>}
      </form>
    </div>
  );
}
