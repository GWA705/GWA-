'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { requestPasswordResetAction, type FormState } from '../actions';
import { useT } from '@/i18n/client';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? t('auth.sending') : t('auth.sendResetLink')}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormState(requestPasswordResetAction, initial);
  const t = useT();

  if (state.ok) {
    return (
      <div className="rounded-md bg-green-50 p-4 text-sm text-green-800" role="status">
        {t('auth.resetLinkSent')}
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
        <label className="label" htmlFor="email">{t('auth.email')}</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <SubmitButton />
    </form>
  );
}
