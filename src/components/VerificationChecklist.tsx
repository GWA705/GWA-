'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { setVerificationCheckAction, type ActionState } from '@/app/(staff)/actions';
import { InfoPopover } from '@/components/InfoPopover';

export type VerificationItem = { key: string; label: string; help?: string };
export type VerificationState = {
  status: 'PENDING' | 'CONFIRMED' | 'PROBLEM';
  note: string | null;
  checkedByName: string | null;
  checkedAt: string | null;
};

function StatusPill({ status }: { status: VerificationState['status'] }) {
  if (status === 'CONFIRMED') return <span className="badge bg-green-100 text-green-800">Confirmed</span>;
  if (status === 'PROBLEM') return <span className="badge bg-red-100 text-red-800">Problem</span>;
  return <span className="badge bg-gray-100 text-gray-600">Not checked</span>;
}

function ActionButton({
  value,
  className,
  children,
}: {
  value: string;
  className: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="status" value={value} className={className} disabled={pending}>
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
  const status = current.status;
  // The problem-note box stays hidden until the reviewer chooses to flag a
  // problem, so each row is compact by default.
  const [flagging, setFlagging] = useState(false);

  return (
    <form action={action} className="rounded-md border border-gray-200 p-3">
      <input type="hidden" name="key" value={item.key} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900">{item.label}</p>
          {item.help && <InfoPopover label={`About: ${item.label}`}>{item.help}</InfoPopover>}
        </div>
        <StatusPill status={status} />
      </div>

      {status === 'PROBLEM' && current.note && !flagging && (
        <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">
          <span className="font-medium">Flagged: </span>
          {current.note}
        </p>
      )}

      {flagging && (
        <div className="mt-3">
          <label className="label text-xs" htmlFor={`note_${item.key}`}>
            Problem note (required — the dealer is notified)
          </label>
          <textarea
            id={`note_${item.key}`}
            name="note"
            rows={2}
            autoFocus
            defaultValue={current.note ?? ''}
            placeholder="Describe what's wrong…"
            className="input text-sm"
          />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {flagging ? (
          <>
            <ActionButton value="PROBLEM" className="btn-danger text-xs">
              Submit problem
            </ActionButton>
            <button type="button" onClick={() => setFlagging(false)} className="btn-secondary text-xs">
              Cancel
            </button>
          </>
        ) : (
          <>
            <ActionButton
              value="CONFIRMED"
              className={status === 'CONFIRMED' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
            >
              {status === 'CONFIRMED' ? '✓ Confirmed' : 'Confirm'}
            </ActionButton>
            <button type="button" onClick={() => setFlagging(true)} className="btn-danger text-xs">
              Flag problem
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
  const remaining = items.filter((i) => (states[i.key]?.status ?? 'PENDING') !== 'CONFIRMED').length;

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md p-2 text-xs ${
          remaining === 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {remaining === 0
          ? 'All checks confirmed — this deal can be funded.'
          : `${remaining} check${remaining === 1 ? '' : 's'} still to confirm before funding.`}
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
