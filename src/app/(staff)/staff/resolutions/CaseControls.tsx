'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { updateCaseStatusAction, assignCaseAction, notifyOfficeAction, addCaseNoteAction, type CaseFormState } from './actions';
import { RESOLUTION_STATUSES, STATUS_LABEL } from '@/lib/resolutionStatus';
import type { ResolutionStatus } from '@prisma/client';

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
          <label className="label" htmlFor="status">Status</label>
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
          <label className="label" htmlFor="assign">Assigned to</label>
          <select
            id="assign"
            defaultValue={assignedToId ?? ''}
            className="input min-w-[180px]"
            onChange={(e) => startT(async () => { await assignCaseAction(caseId, e.target.value); router.refresh(); })}
          >
            <option value="">— Unassigned —</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Notify office (one-way) */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">🔔 Notify {officeName}</h3>
        {canNotifyOffice ? (
          <form ref={notifyRef} action={notifyAction} className="space-y-2">
            {notifyState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{notifyState.error}</div>}
            <textarea name="message" rows={2} required className="input" placeholder={`What should ${officeName} do? e.g. "Please book a service visit for this customer."`} />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 dark:text-slate-500">Sends them an in-portal notice + email. One-way — the case stays here.</p>
              <SubmitBtn idle="Notify office" busy="Sending…" />
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500 dark:text-slate-400">Link this case to the customer&apos;s deal to notify their office.</p>
        )}
      </div>

      {/* Add note */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-slate-100">Add a note</h3>
        <form ref={noteRef} action={noteAction} className="space-y-2">
          {noteState.error && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{noteState.error}</div>}
          <textarea name="body" rows={2} required className="input" placeholder="Add an internal note to the activity log…" />
          <div className="flex justify-end"><SubmitBtn idle="Add note" busy="Saving…" /></div>
        </form>
      </div>
    </div>
  );
}
