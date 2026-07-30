'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendTestEmailAction } from '@/app/(admin)/actions';

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || !enabled}>
      {pending ? 'Sending…' : 'Send test email'}
    </button>
  );
}

export function TestEmailForm({ defaultTo, enabled }: { defaultTo: string; enabled: boolean }) {
  const [state, action] = useFormState(sendTestEmailAction, {} as { error?: string; ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="to">Send to</label>
        <input id="to" name="to" type="email" defaultValue={defaultTo} className="input max-w-md" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton enabled={enabled} />
        {!enabled && <span className="text-xs text-gray-500">Configure SMTP first (see below).</span>}
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
    </form>
  );
}
