'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updateCaseStatusAction, assignCaseAction, notifyOfficeAction, addCaseNoteAction, type CaseFormState } from './actions';
import { RESOLUTION_STATUSES, STATUS_LABEL } from '@/lib/resolutionStatus';
import type { ResolutionStatus } from '@prisma/client';
import { useT } from '@/i18n/client';

function SubmitBtn({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-secondary text-sm" disabled={pending}>{pending ? busy : idle}</button>;
}

export function CaseControls({
  caseId,
  status,
  assignedToId,
  staff,
  canNotifyOffice,
  officeName,
}: {
  caseId: string;
  status: ResolutionStatus;
  assignedToId: string | null;
  staff: { id: string; name: string }[];
  canNotifyOffice: boolean;
  officeName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [, startT] = useTransition();

  const [noteState, noteAction] = useFormState(addCaseNoteAction.bind(null, caseId), {} as CaseFormState);
  const [notifyState, notifyAction] = useFormState(notifyOfficeAction.bind(null, caseId), {} as CaseFormState);
  const noteRef = useRef<HTMLFormElement>(null);
  const notifyRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (noteState.ok) { noteRef.current?.reset(); router.refresh(); } }, [noteState, router]);
  useEffect(() => { if (notifyState.ok) { notifyRef.current?.reset(); router.refresh(); } }, [notifyState, router]);

  return (
    <div className="card p-5 space-y-4">
      {/* Status + assign */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="status">{t('resolution.controls.status')}</label>
          <select
            id="status"
            defaultValue={status}
            className="input min-w-[180px]"
            onChange={(e) => startT(async () => { await updateCaseStatusAction(caseId, e.target.value); router.refresh(); })}
          >
            {RESOLUTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="assign">{t('resolution.controls.assignedTo')}</label>
          <select
            id="assign"
            defaultValue={assignedToId ?? ''}
            className="input min-w-[180px]"
            onChange={(e) => startT(async () => { await assignCaseAction(caseId, e.target.value); router.refresh(); })}
          >
            <option value="">{t('resolution.controls.unassignedOption')}</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Notify office (one-way) */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">🔔 {t('resolution.controls.notifyOffice', { office: officeName })}</h3>
        {canNotifyOffice ? (
          <form ref={notifyRef} action={notifyAction} className="space-y-2">
            {notifyState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{notifyState.error}</div>}
            <textarea name="message" rows={2} required className="input" placeholder={t('resolution.controls.notifyPlaceholder', { office: officeName })} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 dark:text-slate-500">{t('resolution.controls.notifyHint')}</p>
              <SubmitBtn idle={t('resolution.controls.notifyBtn')} busy={t('common.sending')} />
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">{t('resolution.controls.notifyLocked')}</p>
        )}
      </div>

      {/* Add note */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">{t('resolution.controls.addNote')}</h3>
        <form ref={noteRef} action={noteAction} className="space-y-2">
          {noteState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{noteState.error}</div>}
          <textarea name="body" rows={2} required className="input" placeholder={t('resolution.controls.notePlaceholder')} />
          <div className="flex justify-end"><SubmitBtn idle={t('resolution.controls.addNoteBtn')} busy={t('common.saving')} /></div>
        </form>
      </div>
    </div>
  );
}
