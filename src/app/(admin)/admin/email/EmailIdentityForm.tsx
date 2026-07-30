'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveEmailIdentityAction } from '@/app/(admin)/actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function EmailIdentityForm({
  stored,
  effective,
}: {
  stored: { fromName: string | null; fromEmail: string | null; replyTo: string | null };
  effective: { fromName: string; fromEmail: string; replyTo: string };
}) {
  const [state, action] = useFormState(saveEmailIdentityAction, {} as { error?: string; ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fromName">From name (display)</label>
          <input id="fromName" name="fromName" className="input" defaultValue={stored.fromName ?? ''} placeholder="GWA Dealer Portal" />
        </div>
        <div>
          <label className="label" htmlFor="fromEmail">From address (the group it comes from)</label>
          <input id="fromEmail" name="fromEmail" type="email" className="input" defaultValue={stored.fromEmail ?? ''} placeholder="team@ghsbarrie.ca" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="replyTo">Reply-To (the group replies go to)</label>
          <input id="replyTo" name="replyTo" type="email" className="input" defaultValue={stored.replyTo ?? ''} placeholder="team@ghsbarrie.ca" />
          <p className="mt-1 text-xs text-gray-400">Leave blank to send replies to the From address above.</p>
        </div>
      </div>

      <div className="rounded bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-700">In effect now:</p>
        <p className="mt-1">Dealers receive email from <span className="font-medium">{effective.fromName} &lt;{effective.fromEmail}&gt;</span></p>
        <p>Replies go to <span className="font-medium">{effective.replyTo}</span></p>
        <p className="mt-1 text-gray-400">
          Note: the From address must be the SMTP mailbox or a &quot;Send mail as&quot; alias on it, or Google will
          rewrite it. Reply-To can be any group address.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state.ok && state.message && <span className="text-sm text-green-700">{state.message}</span>}
      </div>
    </form>
  );
}
