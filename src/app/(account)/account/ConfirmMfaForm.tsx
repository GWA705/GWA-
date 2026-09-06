'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { confirmMfaAction, type ActionState } from '@/app/(account)/actions';
import { useT } from '@/i18n/client';

function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? t('account.verifying') : t('account.confirmEnable')}
    </button>
  );
}

export function ConfirmMfaForm() {
  const t = useT();
  const [state, action] = useFormState(confirmMfaAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div>
        <label className="label" htmlFor="token">{t('account.enterCodeApp')}</label>
        <input
          id="token"
          name="token"
          inputMode="numeric"
          maxLength={6}
          required
          className="input w-40 tracking-widest"
          placeholder="123456"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
