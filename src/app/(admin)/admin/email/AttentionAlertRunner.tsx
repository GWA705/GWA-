'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runAttentionAlertsNowAction } from '@/app/(admin)/actions';

function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Checking…' : 'Run the 2-hour check now'}
    </button>
  );
}

export function AttentionAlertRunner() {
  const [state, action] = useFormState(runAttentionAlertsNowAction, {} as { ok?: boolean; message?: string });
  return (
    <form action={action} className="space-y-3">
      {state.message && (
        <div className={`rounded-md p-2 text-sm ${state.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {state.message}
        </div>
      )}
      <RunButton />
    </form>
  );
}
