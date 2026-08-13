'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { messageOfficeAction, type MsgState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Sending…' : 'Notify office'}
    </button>
  );
}

export function MessageOffice({ applicationId, officeName }: { applicationId: string; officeName: string }) {
  const [state, action] = useFormState(messageOfficeAction.bind(null, applicationId), {} as MsgState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
      {state.ok ? (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Sent to {officeName}. They&apos;ve been notified the customer called.
        </div>
      ) : (
        <>
          <textarea
            name="message"
            rows={3}
            required
            className="input"
            placeholder={`What should ${officeName} know? e.g. "Customer called about install timing — please call them back."`}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">Saved on the deal and sent to the office as a notification.</p>
            <SubmitButton />
          </div>
        </>
      )}
    </form>
  );
}
