'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  setupMfaSendEmailAction,
  setupMfaConfirmEmailAction,
  setupMfaBeginAppAction,
  setupMfaConfirmAppAction,
  type FormState,
} from '@/app/(auth)/actions';
import { useT } from '@/i18n/client';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

export function SetupTwoFactor({
  email,
  emailEnabled,
  appPending,
  qrDataUrl,
  otpauthUrl,
}: {
  email: string;
  emailEnabled: boolean;
  appPending: boolean;
  qrDataUrl: string;
  otpauthUrl: string;
}) {
  // Default to the authenticator tab if a secret is already pending, else email
  // (unless email isn't available).
  const t = useT();
  const [method, setMethod] = useState<'email' | 'app'>(appPending || !emailEnabled ? 'app' : 'email');
  const [sent, setSent] = useState(false);

  const [sendState, sendAction] = useFormState(async () => {
    const r = await setupMfaSendEmailAction();
    if (r?.ok) setSent(true);
    return r;
  }, {} as FormState);
  const [emailConfirm, emailConfirmAction] = useFormState(setupMfaConfirmEmailAction, {} as FormState);
  const [, beginAppAction] = useFormState(async () => {
    const r = await setupMfaBeginAppAction();
    return r;
  }, {} as FormState);
  const [appConfirm, appConfirmAction] = useFormState(setupMfaConfirmAppAction, {} as FormState);

  return (
    <div className="space-y-5">
      <div className="flex rounded-lg bg-gray-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMethod('email')}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${method === 'email' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'}`}
        >
          {t('auth.tabEmailCode')}
        </button>
        <button
          type="button"
          onClick={() => setMethod('app')}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${method === 'app' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'}`}
        >
          {t('auth.tabAuthApp')}
        </button>
      </div>

      {method === 'email' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('auth.setupEmailIntro', { email })}
          </p>
          {!sent ? (
            <form action={sendAction}>
              <Submit label={t('auth.emailMeCode')} busy={t('auth.sending')} />
              {sendState.error && <p className="mt-2 text-sm text-red-600">{sendState.error}</p>}
            </form>
          ) : (
            <form action={emailConfirmAction} className="space-y-3">
              <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">{t('auth.codeSentCheckEmail')}</div>
              <div>
                <label className="label" htmlFor="token">{t('auth.enter6DigitCode')}</label>
                <input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input tracking-widest" placeholder="123456" />
              </div>
              <Submit label={t('auth.turnOn2fa')} busy={t('auth.verifying')} />
              {emailConfirm.error && <p className="text-sm text-red-600">{emailConfirm.error}</p>}
              <form action={sendAction}>
                <button type="submit" className="text-xs text-gray-500 hover:underline">{t('auth.resendCode')}</button>
              </form>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('auth.setupAppIntro')}
          </p>
          {!appPending ? (
            <form action={beginAppAction}>
              <Submit label={t('auth.showSetupCode')} busy={t('auth.preparing')} />
            </form>
          ) : (
            <>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={t('auth.qrAlt')} className="mx-auto h-44 w-44 rounded bg-white p-2 ring-1 ring-gray-200" />
              )}
              {otpauthUrl && (
                <p className="break-all rounded bg-gray-50 p-2 text-center text-xs text-gray-500">
                  {t('auth.cantScan')} <span className="font-mono">{otpauthUrl.match(/secret=([^&]+)/)?.[1] ?? ''}</span>
                </p>
              )}
              <form action={appConfirmAction} className="space-y-3">
                <div>
                  <label className="label" htmlFor="apptoken">{t('auth.enter6DigitCode')}</label>
                  <input id="apptoken" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input tracking-widest" placeholder="123456" />
                </div>
                <Submit label={t('auth.turnOn2fa')} busy={t('auth.verifying')} />
                {appConfirm.error && <p className="text-sm text-red-600">{appConfirm.error}</p>}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
