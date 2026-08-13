'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { verifyMfaAction, resendMfaEmailAction, type FormState } from '../actions';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Verifying…' : 'Verify'}
    </button>
  );
}

function trustLabel(days: number): string {
  if (days === 1) return 'for 1 day';
  if (days === 7) return 'for 1 week';
  if (days === 14) return 'for 2 weeks';
  if (days === 30) return 'for 1 month';
  return `for ${days} days`;
}

export function MfaForm({ method, trustDays }: { method: 'APP' | 'EMAIL'; trustDays: number }) {
  const [state, action] = useFormState(verifyMfaAction, initial);
  const [resend, resendAction] = useFormState(resendMfaEmailAction, initial);
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
            {method === 'EMAIL' ? 'Emailed code' : 'Authentication code'}
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
            <span>Trust this device {trustLabel(trustDays)} — don&apos;t ask for a code here again on this browser.</span>
          </label>
        )}
        <SubmitButton />
      </form>
      {method === 'EMAIL' && (
        <form action={resendAction} className="text-center">
          <button type="submit" className="text-xs text-brand-700 hover:underline">Resend code</button>
          {resend.ok && <span className="ml-2 text-xs text-green-700">New code sent.</span>}
        </form>
      )}
    </div>
  );
}
