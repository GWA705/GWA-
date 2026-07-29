'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { changePasswordAction, type ActionState } from '@/app/(account)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Change password'}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useFormState(changePasswordAction, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="space-y-4"
    >
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Password changed.</div>}

      <div>
        <label className="label" htmlFor="currentPassword">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm new password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
        </div>
      </div>
      <p className="text-xs text-gray-400">
        At least 12 characters with upper &amp; lower case, a number, and a symbol. Passwords must be changed every 90 days.
      </p>
      <SubmitButton />
    </form>
  );
}
