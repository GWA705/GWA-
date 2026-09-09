'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { XCircle, Clock, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { requestCancellationAction } from '@/app/(dealer)/actions';
import type { ActionState } from '@/app/(dealer)/actions';
import { useT, useI18n } from '@/i18n/client';

export interface CancellationVM {
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  reason: string;
  createdAt: string;
  uninstallDate: string | null;
  wasFunded: boolean;
  hdRefundConfirmed: boolean;
  handledAt: string | null;
  reviewerNote: string | null;
}

const initial: ActionState = {};

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-danger inline-flex items-center gap-2" disabled={pending}>
      <XCircle size={15} /> {pending ? pendingLabel : label}
    </button>
  );
}

export function DealCancelPanel({
  applicationId,
  installed,
  cancelable,
  cancellation,
}: {
  applicationId: string;
  installed: boolean;
  cancelable: boolean;
  cancellation: CancellationVM | null;
}) {
  const t = useT();
  const { locale } = useI18n();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const action = requestCancellationAction.bind(null, applicationId);
  const [state, formAction] = useFormState(action, initial);
  const [open, setOpen] = useState(false);

  // A pending request — show status, no re-request.
  if (cancellation?.status === 'PENDING') {
    return (
      <section className="card border border-amber-300 bg-amber-50 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900"><Clock size={18} /> {t('dealCancel.pendingTitle')}</h2>
        <p className="mt-1 text-sm text-amber-900">{t('dealCancel.pendingBody', { date: fmt(cancellation.createdAt) })}</p>
        <dl className="mt-3 space-y-1 text-sm text-amber-900">
          <div><span className="font-semibold">{t('dealCancel.reasonWord')}:</span> {cancellation.reason}</div>
          {cancellation.uninstallDate && <div><span className="font-semibold">{t('dealCancel.uninstalledWord')}:</span> {fmt(cancellation.uninstallDate)}</div>}
          {cancellation.wasFunded && <div className="flex items-start gap-1.5 text-amber-800"><AlertTriangle size={14} className="mt-0.5 flex-none" /> {t('dealCancel.refundPending')}</div>}
        </dl>
      </section>
    );
  }

  // Confirmed — the deal is closed.
  if (cancellation?.status === 'CONFIRMED') {
    return (
      <section className="card border border-gray-300 bg-gray-50 p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800"><CheckCircle2 size={18} className="text-gray-500" /> {t('dealCancel.confirmedTitle')}</h2>
        <p className="mt-1 text-sm text-gray-700">{t('dealCancel.confirmedBody', { date: cancellation.handledAt ? fmt(cancellation.handledAt) : fmt(cancellation.createdAt) })}</p>
        {cancellation.hdRefundConfirmed && <p className="mt-1 text-sm font-medium text-green-700">✓ {t('dealCancel.refundConfirmed')}</p>}
        {cancellation.reviewerNote && <p className="mt-2 text-sm text-gray-600"><span className="font-semibold">{t('dealCancel.reviewerNoteWord')}:</span> {cancellation.reviewerNote}</p>}
      </section>
    );
  }

  // The request-cancellation control (also shown after a rejection, to re-request).
  if (!cancelable && cancellation?.status !== 'REJECTED') return null;

  return (
    <section className="card border border-gray-200 p-5">
      {cancellation?.status === 'REJECTED' && (
        <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-semibold">{t('dealCancel.rejectedTitle')}.</span> {t('dealCancel.rejectedBody', { date: cancellation.handledAt ? fmt(cancellation.handledAt) : fmt(cancellation.createdAt) })}
          {cancellation.reviewerNote && <div className="mt-1 text-gray-600">{t('dealCancel.reviewerNoteWord')}: {cancellation.reviewerNote}</div>}
        </div>
      )}

      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('dealCancel.requestTitle')}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{installed ? t('dealCancel.installedHint') : t('dealCancel.hint')}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <XCircle size={15} /> {cancellation?.status === 'REJECTED' ? t('dealCancel.reRequest') : t('dealCancel.requestBtn')}
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">{t('dealCancel.requestTitle')}</h2>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {installed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">{t('dealCancel.installedNotice')}</div>
          )}
          <div>
            <label className="label" htmlFor="reason">{t('dealCancel.reasonLabel')} <span className="text-amber-600">*</span></label>
            <textarea id="reason" name="reason" rows={3} required className="input" placeholder={t('dealCancel.reasonPlaceholder')} />
          </div>
          {installed && (
            <div>
              <label className="label" htmlFor="uninstallDate">{t('dealCancel.uninstallLabel')} <span className="text-amber-600">*</span></label>
              <input id="uninstallDate" name="uninstallDate" type="date" required className="input" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <SubmitBtn label={t('dealCancel.submit')} pendingLabel={t('dealCancel.submitting')} />
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">{t('dealCancel.dismiss')}</button>
          </div>
        </form>
      )}
      {state.ok && <p className="mt-2 inline-flex items-center gap-1 text-sm text-green-600"><RotateCcw size={14} /> {t('dealCancel.submitted')}</p>}
    </section>
  );
}
