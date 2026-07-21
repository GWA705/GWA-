'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { verifyMfaAction, type FormState } from '../actions';

const initial: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Verifying…' : 'Verify'}
    </button>
  );
}

export function MfaForm() {
  const [state, action] = useFormState(verifyMfaAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {state.error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="token">
          Authentication code
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
      <SubmitButton />
    </form>
  );
}
