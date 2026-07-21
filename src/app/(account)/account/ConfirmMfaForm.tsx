'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { confirmMfaAction, type ActionState } from '@/app/(account)/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Verifying…' : 'Confirm & enable'}
    </button>
  );
}

export function ConfirmMfaForm() {
  const [state, action] = useFormState(confirmMfaAction, {} as ActionState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
      <div>
        <label className="label" htmlFor="token">Enter the 6-digit code from your app</label>
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
