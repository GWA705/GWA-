'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changeStatusAction, type ActionState } from '@/app/(staff)/actions';
import { MANUAL_STATUS_OPTIONS } from '@/lib/constants';
import { useT } from '@/i18n/client';
import type { ApplicationStatus } from '@prisma/client';

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className="btn-secondary w-full text-sm" disabled={pending}>
      {pending ? t('statusChangeForm.updating') : t('statusChangeForm.updateStatus')}
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
  const t = useT();
  const [state, action] = useFormState(changeStatusAction, {} as ActionState);
  return (
    <form action={action} className="space-y-2">
      {state.error && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{state.error}</div>}
      {state.ok && <div className="rounded-md bg-green-50 p-2 text-xs text-green-700">{t('statusChangeForm.statusUpdated')}</div>}
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="label" htmlFor="status">{t('statusChangeForm.changeStatus')}</label>
      <select id="status" name="status" defaultValue={current} className="input">
        {MANUAL_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{t(`enum.status.${s}`)}</option>
        ))}
      </select>
      <input name="note" className="input" placeholder={t('statusChangeForm.reasonPlaceholder')} />
      <SubmitButton />
    </form>
  );
}
