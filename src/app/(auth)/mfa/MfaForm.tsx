'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { verifyMfaAction, resendMfaEmailAction, type FormState } from '../actions';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? t('auth.verifying') : t('auth.verify')}
    </button>
  );
}

function trustLabel(t: TFunction, days: number): string {
  if (days === 1) return t('auth.trustFor1Day');
  if (days === 7) return t('auth.trustFor1Week');
  if (days === 14) return t('auth.trustFor2Weeks');
  if (days === 30) return t('auth.trustFor1Month');
  return t('auth.trustForDays', { days });
}

export function MfaForm({ method, trustDays }: { method: 'APP' | 'EMAIL'; trustDays: number }) {
  const [state, action] = useFormState(verifyMfaAction, initial);
  const [resend, resendAction] = useFormState(resendMfaEmailAction, initial);
  const t = useT();
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-4">
        {state.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {state.error}
          </div>
        )}
        <div>
          <label className="label" htmlFor="token">
            {method === 'EMAIL' ? t('auth.emailedCode') : t('auth.authCode')}
          </label>
          <input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            className="input tracking-widest text-center text-lg"
            placeholder="123456"
          />
        </div>
        {trustDays > 0 && (
          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" name="trustDevice" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>{t('auth.trustDevice', { duration: trustLabel(t, trustDays) })}</span>
          </label>
        )}
        <SubmitButton />
      </form>
      {method === 'EMAIL' && (
        <form action={resendAction} className="text-center">
          <button type="submit" className="text-xs text-brand-700 hover:underline">{t('auth.resendCode')}</button>
          {resend.ok && <span className="ml-2 text-xs text-green-700">{t('auth.newCodeSent')}</span>}
        </form>
      )}
    </div>
  );
}
