'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { disableMfaAction } from '@/app/(account)/actions';
import type { ActionState } from '@/app/(account)/actions';
import { useT } from '@/i18n/client';

function Button() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? t('account.disabling') : t('account.disable2fa')}
    </button>
  );
}

// Turning off 2FA requires re-entering the current password.
export function DisableMfaForm() {
  const t = useT();
  const [state, action] = useFormState(disableMfaAction, {} as ActionState);
  return (
    <form action={action} className="mt-4 space-y-2">
      <div>
        <label className="label text-xs" htmlFor="disableMfaPassword">
          {t('account.currentPwToDisable')}
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
