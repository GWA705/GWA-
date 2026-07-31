'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction, type FormState } from '../actions';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Saving…' : 'Save new password'}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800" role="status">
          Your password has been updated. You can now sign in.
        </div>
        <Link href="/login" className="btn-primary inline-block w-full text-center">Go to sign in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        <p className="mt-1 text-xs text-gray-400">
          At least 8 characters with upper &amp; lower case, a number, and a symbol.
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
