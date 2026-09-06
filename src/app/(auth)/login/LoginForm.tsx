'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction, type FormState } from '../actions';
import { useT } from '@/i18n/client';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? t('auth.signingIn') : t('auth.signIn')}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useFormState(loginAction, initial);
  const t = useT();
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          {t('auth.email')}
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t('auth.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
        <div className="mt-1 text-right">
          <Link href="/forgot-password" className="text-xs text-brand-700 hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
