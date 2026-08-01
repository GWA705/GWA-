'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { disableMfaAction } from '@/app/(account)/actions';
import type { ActionState } from '@/app/(account)/actions';

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Disabling…' : 'Disable 2FA'}
    </button>
  );
}

// Turning off 2FA requires re-entering the current password.
export function DisableMfaForm() {
  const [state, action] = useFormState(disableMfaAction, {} as ActionState);
  return (
    <form action={action} className="mt-4 space-y-2">
      <div>
        <label className="label text-xs" htmlFor="disableMfaPassword">
          Current password (required to disable 2FA)
        </label>
        <input
          id="disableMfaPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="input max-w-xs"
        />
      </div>
      <Button />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
