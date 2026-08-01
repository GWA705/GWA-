'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runDealerRemindersNowAction } from '@/app/(admin)/actions';

function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={pending}>
      {pending ? 'Checking…' : 'Run the reminder check now'}
    </button>
  );
}

export function ReminderRunner() {
  const [state, action] = useFormState(runDealerRemindersNowAction, {} as { ok?: boolean; message?: string });
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
