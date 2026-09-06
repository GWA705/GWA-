'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { forcedChangePasswordAction, type FormState } from '../actions';
import { useT } from '@/i18n/client';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? t('auth.saving') : t('auth.saveAndContinue')}
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useFormState(forcedChangePasswordAction, initial);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">{t('auth.newPassword')}</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input" />
        <p className="mt-1 text-xs text-gray-400">
          {t('auth.passwordHint')}
        </p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t('auth.confirmNewPassword')}</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
