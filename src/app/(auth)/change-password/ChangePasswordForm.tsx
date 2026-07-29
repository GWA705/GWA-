'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { forcedChangePasswordAction, type FormState } from '../actions';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Saving…' : 'Save and continue'}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useFormState(forcedChangePasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        <p className="mt-1 text-xs text-gray-400">
          At least 12 characters with upper &amp; lower case, a number, and a symbol.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
