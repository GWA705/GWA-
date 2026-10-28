'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/i18n/client';
import type { GiftCardConfirmSummary } from '@/lib/giftCardConfirm';
import {
  markGiftCardReceivedAction,
  flagGiftCardUrgentAction,
  sendGiftCardFromConfirmationAction,
} from './giftCardConfirmActions';

function money(n: number): string {
  return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" /><path d="M12 8v13" />
      <path d="M12 8S10.5 4 8.5 4a2.5 2.5 0 0 0 0 5H12Zm0 0s1.5-4 3.5-4a2.5 2.5 0 0 1 0 5H12Z" />
    </svg>
  );
}

const ImportantTag = ({ label }: { label: string }) => (
  <span className="badge bg-red-100 text-red-700">⚡ {label}</span>
);

export function GiftCardConfirmSection({
  applicationId,
  applicantEmail,
  giftCard,
}: {
  applicationId: string;
  applicantEmail: string;
  giftCard: GiftCardConfirmSummary | null;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Terminal success line after an action (keeps the UI from re-prompting).
  const [done, setDone] = useState<string | null>(giftCard?.receivedAt ? t('giftCardConfirm.doneReceived') : null);
  const [showResend, setShowResend] = useState(false);

  // Fields for a resend / new request.
  const [email, setEmail] = useState((giftCard?.email || applicantEmail || '').trim());
  const [amount, setAmount] = useState(String(giftCard?.amount ?? 25));
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, onOk: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else onOk();
    });
  };

  const noEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault(); };

  // Shared header.
  const header = (
    <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><GiftIcon /></span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {t('giftCardConfirm.title')}
          {giftCard && <span className="badge bg-gray-100 text-gray-600">{money(giftCard.amount)}</span>}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">{t('giftCardConfirm.subtitle')}</p>
      </div>
    </div>
  );

  // The resend / new-request form (shared by "not received" and "none on record").
  const requestForm = (variant: 'resend' | 'new') => (
    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/70 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-700">
        {variant === 'resend' ? t('giftCardConfirm.notReceivedTitle') : t('giftCardConfirm.newTitle')}
      </p>
      <p className="mb-3 text-xs text-gray-500">{variant === 'resend' ? t('giftCardConfirm.notReceivedSub') : t('giftCardConfirm.newSub')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">{t('giftCardConfirm.emailLabel')}</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={noEnter} type="email" />
          <p className="mt-1 text-xs text-gray-400">{t('giftCardConfirm.emailWhat')}</p>
        </div>
        <div>
          <label className="label">{t('giftCardConfirm.amountLabel')}</label>
          <input className="input" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={noEnter} type="number" min="1" step="0.01" />
          <p className="mt-1 text-xs text-gray-400">{t('giftCardConfirm.amountWhat')}</p>
        </div>
      </div>
      <div className="mt-3">
        <label className="label">{t('giftCardConfirm.noteLabel')}</label>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={variant === 'resend' ? t('giftCardConfirm.notePlaceholderResend') : t('giftCardConfirm.notePlaceholderNew')} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary text-sm" disabled={pending}
          onClick={() => run(
            () => sendGiftCardFromConfirmationAction({ applicationId, email, amount: Number(amount), note }),
            () => setDone(t(variant === 'resend' ? 'giftCardConfirm.successResent' : 'giftCardConfirm.successRequested', { amount: money(Number(amount) || 0) })),
          )}>
          {pending ? t('giftCardConfirm.working') : (variant === 'resend' ? t('giftCardConfirm.btnSendNew') : t('giftCardConfirm.btnRequest'))}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-gray-500">⚡ {t('giftCardConfirm.importantNote')}</span>
      </div>
    </div>
  );

  let body: React.ReactNode;

  if (done) {
    body = (
      <div className="mt-3 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
        <span aria-hidden="true">✓</span><span>{done}</span>
      </div>
    );
  } else if (giftCard && giftCard.status === 'SENT') {
    body = (
      <>
        <div className="mt-3 flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-3">
          <span className="mt-0.5 text-green-600" aria-hidden="true">✓</span>
          <div className="text-sm">
            <p className="font-semibold text-green-800">{t('giftCardConfirm.sentBanner', { amount: money(giftCard.amount), date: fmtDate(giftCard.sentAt) })}</p>
            <p className="text-xs text-green-700">
              {t('giftCardConfirm.sentTo', { email: giftCard.email })}{giftCard.sentByName ? ` · ${t('giftCardConfirm.sentBy', { name: giftCard.sentByName })}` : ''}
            </p>
          </div>
        </div>
        {showResend ? requestForm('resend') : (
          <div className="mt-3">
            <p className="text-sm font-medium text-gray-800">{t('giftCardConfirm.askReceived', { amount: money(giftCard.amount) })}</p>
            <p className="text-xs text-gray-500">{t('giftCardConfirm.askReceivedSub')}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" className="btn-primary text-sm" disabled={pending}
                onClick={() => run(() => markGiftCardReceivedAction(giftCard.id, true, applicationId), () => setDone(t('giftCardConfirm.doneReceived')))}>
                ✓ {t('giftCardConfirm.btnYes')}
              </button>
              <button type="button" className="btn-secondary text-sm" disabled={pending} onClick={() => { setError(null); setShowResend(true); }}>
                ✕ {t('giftCardConfirm.btnNo')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  } else if (giftCard && giftCard.status === 'PENDING') {
    body = (
      <>
        <div className="mt-3 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <span className="mt-0.5 text-amber-600" aria-hidden="true">⏳</span>
          <div className="text-sm">
            <p className="font-semibold text-amber-800">{t('giftCardConfirm.queuedBanner', { amount: money(giftCard.amount), date: fmtDate(giftCard.sentAt) })}</p>
            <p className="text-xs text-amber-700">{t('giftCardConfirm.queuedSub')}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-700">{t('giftCardConfirm.queuedAsk')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {giftCard.important ? (
            <ImportantTag label={t('giftCardConfirm.alreadyUrgent')} />
          ) : (
            <button type="button" className="btn-primary text-sm" disabled={pending}
              onClick={() => run(() => flagGiftCardUrgentAction(giftCard.id, applicationId), () => setDone(t('giftCardConfirm.successUrgent')))}>
              ⚡ {t('giftCardConfirm.btnUrgent')}
            </button>
          )}
          {!giftCard.important && <span className="text-xs text-gray-500">{t('giftCardConfirm.urgentNote')}</span>}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="mt-3 flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <span className="mt-0.5 text-gray-400" aria-hidden="true">🔎</span>
          <div className="text-sm">
            <p className="font-semibold text-gray-800">{t('giftCardConfirm.noneBanner')}</p>
            <p className="text-xs text-gray-500">{t('giftCardConfirm.noneSub')}</p>
          </div>
        </div>
        {requestForm('new')}
      </>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      {header}
      <p className="mt-3 flex items-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
        {t('giftCardConfirm.checkedFor', { email: (applicantEmail || giftCard?.email || '—').trim() })}
      </p>
      {error && <div className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      {body}
    </section>
  );
}
