'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendTestSmsAction } from '@/app/(admin)/actions';

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || !enabled}>
      {pending ? 'Sending…' : 'Send test text'}
    </button>
  );
}

export function TestSmsForm({ defaultTo, enabled }: { defaultTo?: string; enabled: boolean }) {
  const [state, action] = useFormState(sendTestSmsAction, {} as { error?: string; ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="smsTo">Send to (mobile number)</label>
        <input
          id="smsTo"
          name="to"
          type="tel"
          inputMode="tel"
          placeholder="705-555-0123"
          defaultValue={defaultTo}
          className="input max-w-md"
        />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton enabled={enabled} />
        {!enabled && <span className="text-xs text-gray-500">Configure Twilio first (see below).</span>}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
