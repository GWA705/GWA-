'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { confirmCancellationAction, rejectCancellationAction, sendChargebackRequestAction, type CancellationActionState } from '@/app/(staff)/actions';
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
  // Chargeback (funded deals only): the editable request email + recipients, and
  // the request/completion status once it's been sent.
  chargeback: {
    from: string;
    to: string;
    cc: string | null;
    subject: string;
    body: string;
    requestedAt: string | null;
    completedAt: string | null;
  } | null;
}

const initial: CancellationActionState = {};

function Btn({ kind, label, pendingLabel, disabled, icon }: { kind: 'confirm' | 'reject'; label: string; pendingLabel: string; disabled?: boolean; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  const cls = kind === 'confirm' ? 'btn-primary' : 'btn-secondary';
  return (
    <button type="submit" className={`${cls} inline-flex items-center gap-2 text-sm`} disabled={pending || disabled}>
      {icon ?? (kind === 'confirm' ? <CheckCircle2 size={15} /> : <XCircle size={15} />)}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CancellationReviewCard({ c }: { c: CancellationReviewVM }) {
  const t = useT();
  const [confirmState, confirmAction] = useFormState(confirmCancellationAction.bind(null, c.id), initial);
  const [rejectState, rejectAction] = useFormState(rejectCancellationAction.bind(null, c.id), initial);
  const [cbState, cbAction] = useFormState(sendChargebackRequestAction.bind(null, c.id), initial);
  const [note, setNote] = useState('');
  const [hdRefund, setHdRefund] = useState(false);
  const [subject, setSubject] = useState(c.chargeback?.subject ?? '');
  const [body, setBody] = useState(c.chargeback?.body ?? '');

  if (c.status !== 'PENDING') {
    const confirmed = c.status === 'CONFIRMED';
    const cb = c.chargeback;
    return (
      <section className={`rounded-lg border p-4 ${confirmed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
        <h3 className="text-sm font-semibold text-gray-900">{confirmed ? t('staffCards.cancellation.headingConfirmed') : t('staffCards.cancellation.headingDeclined')}</h3>
        <p className="mt-1 text-xs text-gray-500">{c.handledBy ?? t('staffCards.cancellation.reviewerFallback')} · {c.handledAt ?? ''}</p>
        <p className="mt-2 text-sm text-gray-700"><span className="font-medium">{t('staffCards.cancellation.reasonLabel')}</span> {c.reason}</p>
        {c.uninstallDate && <p className="text-sm text-gray-700"><span className="font-medium">{t('staffCards.cancellation.uninstalledLabel')}</span> {c.uninstallDate}</p>}
        {/* Chargeback status for a funded deal: requested, then completed. */}
        {confirmed && c.wasFunded && cb?.requestedAt && (
          cb.completedAt ? (
            <p className="mt-1 text-sm font-medium text-green-700">✓ {t('staffCards.cancellation.chargebackCompleted', { date: cb.completedAt })}</p>
          ) : (
            <p className="mt-1 text-sm font-medium text-amber-700">⏳ {t('staffCards.cancellation.chargebackPending', { date: cb.requestedAt })}</p>
          )
        )}
        {confirmed && c.wasFunded && !cb?.requestedAt && <p className="mt-1 text-sm font-medium text-green-700">{t('staffCards.cancellation.hdRefundConfirmedDone')}</p>}
        {c.reviewerNote && <p className="mt-1 text-sm text-gray-600"><span className="font-medium">{t('staffCards.cancellation.reviewerNoteLabel')}</span> {c.reviewerNote}</p>}
      </section>
    );
  }

  const err = confirmState.error || rejectState.error || cbState.error;
  const fundedWithChargeback = c.wasFunded && !!c.chargeback;

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

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {/* Reviewer note — shared by both paths. */}
      <div className="mt-3">
        <label className="label" htmlFor={`cnote-${c.id}`}>{t('staffCards.cancellation.reviewerNoteFieldLabel')} <span className="font-normal text-gray-400">{t('staffCards.cancellation.reviewerNoteFieldHint')}</span></label>
        <textarea id={`cnote-${c.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input" placeholder="e.g. uninstalled 2026-09-10; customer moved" />
      </div>

      {fundedWithChargeback ? (
        <>
          {/* Funded deal → request a chargeback from Home Depot Central Settlement. */}
          <div className="mt-3 rounded-md border border-amber-300 bg-white/70 p-3 text-sm text-amber-900">
            {t('staffCards.cancellation.chargebackNotice')}
          </div>
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700"><Mail size={13} /> {t('staffCards.cancellation.chargebackEmailTitle')}</p>
            <div className="space-y-1 text-xs text-gray-500">
              <p><span className="font-semibold text-gray-600">{t('staffCards.cancellation.from')}</span> {c.chargeback!.from}</p>
              <p><span className="font-semibold text-gray-600">{t('staffCards.cancellation.to')}</span> {c.chargeback!.to}{c.chargeback!.cc ? <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">Cc: {c.chargeback!.cc}</span> : null}</p>
            </div>
            <div className="mt-2">
              <label className="label text-xs" htmlFor={`cbsubj-${c.id}`}>{t('staffCards.cancellation.subject')}</label>
              <input id={`cbsubj-${c.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} className="input text-sm" />
            </div>
            <div className="mt-2">
              <label className="label text-xs" htmlFor={`cbbody-${c.id}`}>{t('staffCards.cancellation.message')} <span className="font-normal text-gray-400">{t('staffCards.cancellation.editableHint')}</span></label>
              <textarea id={`cbbody-${c.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="input font-mono text-xs" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={cbAction}>
              <input type="hidden" name="note" value={note} />
              <input type="hidden" name="subject" value={subject} />
              <input type="hidden" name="body" value={body} />
              <Btn kind="confirm" label={t('staffCards.cancellation.sendChargebackBtn')} pendingLabel={t('staffCards.cancellation.sendingBtn')} disabled={!body.trim()} icon={<Mail size={15} />} />
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="note" value={note} />
              <Btn kind="reject" label={t('staffCards.cancellation.rejectBtn')} pendingLabel={t('staffCards.cancellation.rejectingBtn')} />
            </form>
          </div>
          <p className="mt-2 text-xs text-amber-700">{t('staffCards.cancellation.chargebackSendHint')}</p>
        </>
      ) : (
        <>
          {/* Un-funded deal → a plain confirm (no money to claw back). */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={confirmAction}>
              <input type="hidden" name="note" value={note} />
              <input type="hidden" name="hdRefundConfirmed" value={hdRefund ? '1' : '0'} />
              <Btn kind="confirm" label={t('staffCards.cancellation.confirmBtn')} pendingLabel={t('staffCards.cancellation.confirmingBtn')} />
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="note" value={note} />
              <Btn kind="reject" label={t('staffCards.cancellation.rejectBtn')} pendingLabel={t('staffCards.cancellation.rejectingBtn')} />
            </form>
          </div>
        </>
      )}
    </section>
  );
}
