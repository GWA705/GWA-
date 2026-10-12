'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { confirmCancellationAction, rejectCancellationAction, type CancellationActionState } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

export interface CancellationReviewVM {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  reason: string;
  requestedBy: string;
  requestedAt: string;
  wasFunded: boolean;
  uninstallDate: string | null;
  hdRefundConfirmed: boolean;
  handledAt: string | null;
  handledBy: string | null;
  reviewerNote: string | null;
}

const initial: CancellationActionState = {};

function Btn({ kind, label, pendingLabel, disabled }: { kind: 'confirm' | 'reject'; label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const cls = kind === 'confirm' ? 'btn-primary' : 'btn-secondary';
  return (
    <button type="submit" className={`${cls} inline-flex items-center gap-2 text-sm`} disabled={pending || disabled}>
      {kind === 'confirm' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CancellationReviewCard({ c }: { c: CancellationReviewVM }) {
  const t = useT();
  const [confirmState, confirmAction] = useFormState(confirmCancellationAction.bind(null, c.id), initial);
  const [rejectState, rejectAction] = useFormState(rejectCancellationAction.bind(null, c.id), initial);
  const [note, setNote] = useState('');
  const [hdRefund, setHdRefund] = useState(false);

  if (c.status !== 'PENDING') {
    const confirmed = c.status === 'CONFIRMED';
    return (
      <section className={`rounded-lg border p-4 ${confirmed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
        <h3 className="text-sm font-semibold text-gray-900">{confirmed ? t('staffCards.cancellation.headingConfirmed') : t('staffCards.cancellation.headingDeclined')}</h3>
        <p className="mt-1 text-xs text-gray-500">{c.handledBy ?? t('staffCards.cancellation.reviewerFallback')} · {c.handledAt ?? ''}</p>
        <p className="mt-2 text-sm text-gray-700"><span className="font-medium">{t('staffCards.cancellation.reasonLabel')}</span> {c.reason}</p>
        {c.uninstallDate && <p className="text-sm text-gray-700"><span className="font-medium">{t('staffCards.cancellation.uninstalledLabel')}</span> {c.uninstallDate}</p>}
        {confirmed && c.wasFunded && <p className="mt-1 text-sm font-medium text-green-700">{t('staffCards.cancellation.hdRefundConfirmedDone')}</p>}
        {c.reviewerNote && <p className="mt-1 text-sm text-gray-600"><span className="font-medium">{t('staffCards.cancellation.reviewerNoteLabel')}</span> {c.reviewerNote}</p>}
      </section>
    );
  }

  const err = confirmState.error || rejectState.error;
  return (
    <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <AlertTriangle size={16} /> {t('staffCards.cancellation.requestedTitle')}{c.wasFunded ? t('staffCards.cancellation.requestedTitleSuffix') : ''}
      </h3>
      <p className="mt-1 text-xs text-amber-800">{c.requestedBy} · {c.requestedAt}</p>

      <dl className="mt-3 space-y-1 text-sm text-gray-800">
        <div><span className="font-semibold">{t('staffCards.cancellation.reasonShort')}</span> {c.reason}</div>
        {c.uninstallDate && <div><span className="font-semibold">{t('staffCards.cancellation.uninstalledLabel')}</span> {c.uninstallDate}</div>}
      </dl>

      {c.wasFunded && (
        <div className="mt-3 rounded-md border border-amber-300 bg-white/70 p-3 text-sm text-amber-900">
          {t('staffCards.cancellation.fundedNotice1')}<strong>{t('staffCards.cancellation.fundedNoticeWord')}</strong>{t('staffCards.cancellation.fundedNotice2')}
        </div>
      )}

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-3">
        <label className="label" htmlFor={`cnote-${c.id}`}>{t('staffCards.cancellation.reviewerNoteFieldLabel')} <span className="font-normal text-gray-400">{t('staffCards.cancellation.reviewerNoteFieldHint')}</span></label>
        <textarea id={`cnote-${c.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input" placeholder="e.g. HD refund confirmed by J. on 2026-09-10, ref #…" />
      </div>

      {c.wasFunded && (
        <label className="mt-2 flex items-center gap-2 text-sm font-medium text-amber-900">
          <input type="checkbox" checked={hdRefund} onChange={(e) => setHdRefund(e.target.checked)} className="h-4 w-4" />
          {t('staffCards.cancellation.hdRefundCheckboxLabel')}
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action={confirmAction}>
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="hdRefundConfirmed" value={hdRefund ? '1' : '0'} />
          <Btn kind="confirm" label={t('staffCards.cancellation.confirmBtn')} pendingLabel={t('staffCards.cancellation.confirmingBtn')} disabled={c.wasFunded && !hdRefund} />
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="note" value={note} />
          <Btn kind="reject" label={t('staffCards.cancellation.rejectBtn')} pendingLabel={t('staffCards.cancellation.rejectingBtn')} />
        </form>
      </div>
      {c.wasFunded && !hdRefund && <p className="mt-2 text-xs text-amber-700">{t('staffCards.cancellation.enableHint')}</p>}
    </section>
  );
}
