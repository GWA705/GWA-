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
          Email code
        </button>
        <button
          type="button"
          onClick={() => setMethod('app')}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium ${method === 'app' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-600'}`}
        >
          Authenticator app
        </button>
      </div>

      {method === 'email' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            We&apos;ll email a 6-digit code to <span className="font-medium">{email}</span> each time you
            sign in.
          </p>
          {!sent ? (
            <form action={sendAction}>
              <Submit label="Email me a code" busy="Sending…" />
              {sendState.error && <p className="mt-2 text-sm text-red-600">{sendState.error}</p>}
            </form>
          ) : (
            <form action={emailConfirmAction} className="space-y-3">
              <div className="rounded-md bg-green-50 p-2 text-sm text-green-700">Code sent — check your email.</div>
              <div>
                <label className="label" htmlFor="token">Enter the 6-digit code</label>
                <input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input tracking-widest" placeholder="123456" />
              </div>
              <Submit label="Turn on 2FA" busy="Verifying…" />
              {emailConfirm.error && <p className="text-sm text-red-600">{emailConfirm.error}</p>}
              <form action={sendAction}>
                <button type="submit" className="text-xs text-gray-500 hover:underline">Resend code</button>
              </form>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Use an authenticator app (Google Authenticator, Authy, 1Password, etc.). Scan the code, then
            enter the 6-digit number it shows.
          </p>
          {!appPending ? (
            <form action={beginAppAction}>
              <Submit label="Show my setup code" busy="Preparing…" />
            </form>
          ) : (
            <>
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Authenticator QR code" className="mx-auto h-44 w-44 rounded bg-white p-2 ring-1 ring-gray-200" />
              )}
              {otpauthUrl && (
                <p className="break-all rounded bg-gray-50 p-2 text-center text-xs text-gray-500">
                  Can&apos;t scan? Enter this key: <span className="font-mono">{otpauthUrl.match(/secret=([^&]+)/)?.[1] ?? ''}</span>
                </p>
              )}
              <form action={appConfirmAction} className="space-y-3">
                <div>
                  <label className="label" htmlFor="apptoken">Enter the 6-digit code</label>
                  <input id="apptoken" name="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input tracking-widest" placeholder="123456" />
                </div>
                <Submit label="Turn on 2FA" busy="Verifying…" />
                {appConfirm.error && <p className="text-sm text-red-600">{appConfirm.error}</p>}
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
