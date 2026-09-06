'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { resetPasswordAction, type FormState } from '../actions';
import { useT } from '@/i18n/client';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? t('auth.saving') : t('auth.saveNewPassword')}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, initial);
  const t = useT();

  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-800" role="status">
          {t('auth.passwordUpdated')}
        </div>
        <Link href="/login" className="btn-primary inline-block w-full text-center">{t('auth.goToSignIn')}</Link>
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
