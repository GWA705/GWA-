'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordResetAction, type FormState } from '../actions';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Sending…' : 'Send reset link'}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordResetAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-800" role="status">
        If an account exists for that email, a password reset link is on its way.
        The link expires in 60 minutes.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
