'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runDocRemindersNowAction } from '@/app/(admin)/actions';

function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Checking…' : 'Run the reminder check now'}
    </button>
  );
}

export function DocReminderRunner() {
  const [state, action] = useFormState(
    runDocRemindersNowAction,
    {} as { ok?: boolean; message?: string; error?: string },
  );
  const msg = state.message || state.error;
  return (
    <form action={action} className="space-y-3">
      {msg && (
        <div className={`rounded-md p-2 text-sm ${state.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}
      <RunButton />
    </form>
  );
}
