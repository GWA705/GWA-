'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changeStatusAction, type ActionState } from '@/app/(staff)/actions';
import { MANUAL_STATUS_OPTIONS, STATUS_LABELS } from '@/lib/constants';
import type { ApplicationStatus } from '@prisma/client';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary w-full text-sm" disabled={pending}>
      {pending ? 'Updating…' : 'Update status'}
    </button>
  );
}

export function StatusChangeForm({
  applicationId,
  current,
}: {
  applicationId: string;
  current: ApplicationStatus;
}) {
  const [state, action] = useFormState(changeStatusAction, {} as ActionState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">Status updated.</div>}
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="label" htmlFor="status">Change status</label>
      <select id="status" name="status" defaultValue={current} className="input">
        {MANUAL_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      <input name="note" className="input" placeholder="Reason (optional)" />
      <SubmitButton />
    </form>
  );
}
