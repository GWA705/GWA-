'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setVerificationCheckAction, type ActionState } from '@/app/(staff)/actions';
import { InfoPopover } from '@/components/InfoPopover';
import { useT } from '@/i18n/client';
import type { TFunction } from '@/i18n/translator';

export type VerificationItem = { key: string; label: string; help?: string };
export type VerificationState = {
  status: 'PENDING' | 'CONFIRMED' | 'PROBLEM';
  note: string | null;
  checkedByName: string | null;
  checkedAt: string | null;
};

function StatusPill({ status, t }: { status: VerificationState['status']; t: TFunction }) {
  if (status === 'CONFIRMED') return <span className="badge bg-green-100 text-green-800">{t('verificationChecklist.confirmed')}</span>;
  if (status === 'PROBLEM') return <span className="badge bg-red-100 text-red-800">{t('verificationChecklist.problem')}</span>;
  return <span className="badge bg-gray-100 text-gray-600">{t('verificationChecklist.notChecked')}</span>;
}

function ActionButton({
  value,
  className,
  children,
  onClick,
}: {
  value: string;
  className: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="status" value={value} className={className} disabled={pending} onClick={onClick}>
      {children}
    </button>
  );
}

function ChecklistItem({
  applicationId,
  item,
  current,
}: {
  applicationId: string;
  item: VerificationItem;
  current: VerificationState;
}) {
  const [state, action] = useFormState(
    setVerificationCheckAction.bind(null, applicationId),
    {} as ActionState,
  );
  // Optimistic status — the pill and Confirm button flip the instant the reviewer
  // clicks, while the save runs in the background. The row re-mounts (its key
  // includes the stored status) once the server confirms, clearing this.
  const [optimistic, setOptimistic] = useState<VerificationState['status'] | null>(null);
  const status = optimistic ?? current.status;
  // The problem-note box stays hidden until the reviewer chooses to flag a
  // problem, so each row is compact by default.
  const [flagging, setFlagging] = useState(false);
  const t = useT();
  const label = t(`verificationChecklist.${item.key}`);
  const help = item.help ? t(`verificationChecklist.${item.key}_help`) : null;

  return (
    <form action={action} className="rounded-md border border-gray-200 p-3">
      <input type="hidden" name="key" value={item.key} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {help && <InfoPopover label={t('verificationChecklist.about', { label })}>{help}</InfoPopover>}
        </div>
        <StatusPill status={status} t={t} />
      </div>

      {status === 'PROBLEM' && current.note && !flagging && (
        <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">
          <span className="font-medium">{t('verificationChecklist.flagged')}</span>
          {current.note}
        </p>
      )}

      {flagging && (
        <div className="mt-3">
          <label className="label text-xs" htmlFor={`note_${item.key}`}>
            {t('verificationChecklist.problemNoteLabel')}
          </label>
          <textarea
            id={`note_${item.key}`}
            name="note"
            rows={2}
            autoFocus
            defaultValue={current.note ?? ''}
            placeholder={t('verificationChecklist.describePlaceholder')}
            className="input text-sm"
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {flagging ? (
          <>
            <ActionButton value="PROBLEM" className="btn-danger text-xs" onClick={() => setOptimistic('PROBLEM')}>
              {t('verificationChecklist.submitProblem')}
            </ActionButton>
            <button type="button" onClick={() => setFlagging(false)} className="btn-secondary text-xs">
              {t('verificationChecklist.cancel')}
            </button>
          </>
        ) : (
          <>
            <ActionButton
              value="CONFIRMED"
              className={status === 'CONFIRMED' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
              onClick={() => setOptimistic('CONFIRMED')}
            >
              {status === 'CONFIRMED' ? t('verificationChecklist.confirmedBtn') : t('verificationChecklist.confirmBtn')}
            </ActionButton>
            <button type="button" onClick={() => setFlagging(true)} className="btn-danger text-xs">
              {t('verificationChecklist.flagProblem')}
            </button>
          </>
        )}
        {status !== 'PENDING' && current.checkedByName && (
          <span className="text-xs text-gray-400">
            {current.checkedByName}
            {current.checkedAt ? ` · ${new Date(current.checkedAt).toLocaleString('en-CA')}` : ''}
          </span>
        )}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/**
 * Rule 2 — the reviewer's funding verification checklist. Every item must be
 * Confirmed before the deal can be funded. Flagging a Problem requires a note,
 * which is sent to the dealer.
 */
export function VerificationChecklist({
  applicationId,
  items,
  states,
}: {
  applicationId: string;
  items: VerificationItem[];
  states: Record<string, VerificationState>;
}) {
  const t = useT();
  const remaining = items.filter((i) => (states[i.key]?.status ?? 'PENDING') !== 'CONFIRMED').length;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md p-2 text-xs ${
          remaining === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {remaining === 0
          ? t('verificationChecklist.allConfirmed')
          : t(remaining === 1 ? 'verificationChecklist.remainingOne' : 'verificationChecklist.remainingMany', { n: remaining })}
      </div>
      {items.map((item) => (
        <ChecklistItem
          // Re-mount when the stored status changes so the form resets cleanly.
          key={`${item.key}:${states[item.key]?.status ?? 'PENDING'}`}
          applicationId={applicationId}
          item={item}
          current={
            states[item.key] ?? { status: 'PENDING', note: null, checkedByName: null, checkedAt: null }
          }
        />
      ))}
    </div>
  );
}
