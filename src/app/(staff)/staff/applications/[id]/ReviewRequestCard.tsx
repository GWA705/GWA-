'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendReviewRequestAction, setCustomerEmailAction, setCustomerPhoneAction, setReviewLinkAction } from '@/app/(staff)/actions';
import { useT } from '@/i18n/client';

/**
 * Confirmation-step action: send the customer a "leave us a review" request by
 * email (and text, once an SMS provider is configured). Lets staff add a missing
 * customer email inline, and lets an admin set the global review link inline the
 * first time. Records the last send so it's clear it went out.
 */
export function ReviewRequestCard({
  applicationId,
  customerEmail,
  customerPhone,
  reviewLinkSet,
  smsConfigured,
  canManageLink,
  sentAt,
  sentVia,
  sentByName,
}: {
  applicationId: string;
  customerEmail: string;
  customerPhone: string;
  reviewLinkSet: boolean;
  smsConfigured: boolean;
  canManageLink: boolean;
  sentAt: string | null;
  sentVia: string | null;
  sentByName: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState(customerEmail);
  const [emailDraft, setEmailDraft] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [phone, setPhone] = useState(customerPhone);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [alsoText, setAlsoText] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const hasEmail = !!email.trim();
  const when = sentAt
    ? new Date(sentAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const viaLabel = sentVia ? sentVia.replace('email', t('staffCards.reviewRequest.viaEmail')).replace('sms', t('staffCards.reviewRequest.viaText')).replace('+', ' + ') : '';

  function saveEmail() {
    setMsg(null);
    start(async () => {
      const r = await setCustomerEmailAction(applicationId, emailDraft);
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setEmail(emailDraft.trim());
      setEditingEmail(false);
      setEmailDraft('');
      router.refresh();
    });
  }

  function savePhone() {
    setMsg(null);
    start(async () => {
      const r = await setCustomerPhoneAction(applicationId, phoneDraft);
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setPhone(phoneDraft.trim());
      setEditingPhone(false);
      setPhoneDraft('');
      router.refresh();
    });
  }

  function saveLink() {
    setMsg(null);
    start(async () => {
      const r = await setReviewLinkAction(linkDraft);
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setLinkDraft('');
      router.refresh();
    });
  }

  function send() {
    setMsg(null);
    start(async () => {
      const r = await sendReviewRequestAction(applicationId, { email: true, sms: alsoText });
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setMsg({ kind: 'ok', text: r.note ? r.note : t('staffCards.reviewRequest.sentDefault') });
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">⭐</span>
        <h3 className="text-sm font-semibold text-gray-900">{t('staffCards.reviewRequest.heading')}</h3>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">
        {t('staffCards.reviewRequest.subtitle')}
      </p>

      {sentAt && (
        <p className="mt-2 rounded-md border-l-4 border-green-500 bg-green-50 p-2 text-xs text-green-800">
          {t('staffCards.reviewRequest.lastSent', { when })}{sentByName ? t('staffCards.reviewRequest.lastSentBy', { name: sentByName }) : ''}{viaLabel ? t('staffCards.reviewRequest.lastSentVia', { via: viaLabel }) : ''}.
        </p>
      )}

      {/* No review link configured yet */}
      {!reviewLinkSet ? (
        canManageLink ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <label className="block text-xs font-medium text-amber-900">{t('staffCards.reviewRequest.setLinkLabel')}</label>
            <p className="mb-2 text-[11px] text-amber-700">{t('staffCards.reviewRequest.setLinkHint')}</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={saveLink}
                disabled={pending || !linkDraft.trim()}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? t('common.saving') : t('staffCards.reviewRequest.saveLink')}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-gray-50 p-2 text-xs text-gray-500">
            {t('staffCards.reviewRequest.noLinkNote')}
          </p>
        )
      ) : (
        <>
          {/* Customer email row */}
          <div className="mt-3 text-sm">
            {hasEmail && !editingEmail ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">{t('staffCards.reviewRequest.emailLabel')}</span>
                <span className="font-medium text-gray-800">{email}</span>
                <button type="button" onClick={() => { setEditingEmail(true); setEmailDraft(email); }} className="text-xs text-brand-700 hover:underline">
                  {t('staffCards.reviewRequest.change')}
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <label className="block text-xs font-medium text-gray-700">
                  {hasEmail ? t('staffCards.reviewRequest.updateEmailLabel') : t('staffCards.reviewRequest.noEmailLabel')}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="customer@email.com"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={saveEmail}
                    disabled={pending || !emailDraft.trim()}
                    className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {pending ? t('common.saving') : t('common.save')}
                  </button>
                  {hasEmail && (
                    <button type="button" onClick={() => setEditingEmail(false)} className="px-2 py-1.5 text-sm text-gray-500 hover:underline">
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Also-text option */}
          {editingPhone ? (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <label className="block text-xs font-medium text-gray-700">
                {phone.trim() ? t('staffCards.reviewRequest.updatePhoneLabel') : t('staffCards.reviewRequest.addPhoneLabel')}
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="905-555-0123"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={savePhone}
                  disabled={pending || !phoneDraft.trim()}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? t('common.saving') : t('common.save')}
                </button>
                <button type="button" onClick={() => { setEditingPhone(false); setPhoneDraft(''); }} className="px-2 py-1.5 text-sm text-gray-500 hover:underline">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <label className={`mt-3 flex flex-wrap items-center gap-2 text-sm ${smsConfigured ? 'text-gray-700' : 'text-gray-400'}`}>
              <input
                type="checkbox"
                checked={alsoText}
                disabled={!smsConfigured || !phone.trim()}
                onChange={(e) => setAlsoText(e.target.checked)}
              />
              {t('staffCards.reviewRequest.alsoText', { who: phone.trim() || t('staffCards.reviewRequest.theCustomer') })}
              <button
                type="button"
                onClick={() => { setEditingPhone(true); setPhoneDraft(phone); setMsg(null); }}
                className="text-xs text-brand-700 hover:underline"
              >
                {phone.trim() ? t('staffCards.reviewRequest.change') : t('staffCards.reviewRequest.addNumber')}
              </button>
              {!smsConfigured && <span className="text-xs">{t('staffCards.reviewRequest.smsNotSetUp')}</span>}
            </label>
          )}

          {/* Send */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || (!hasEmail && !alsoText)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? t('common.sending') : sentAt ? t('staffCards.reviewRequest.sendAgain') : t('staffCards.reviewRequest.sendRequest')}
            </button>
            {!hasEmail && !alsoText && (
              <span className="text-xs text-gray-400">{t('staffCards.reviewRequest.addEmailHint')}</span>
            )}
          </div>
        </>
      )}

      {msg && (
        <p className={`mt-3 rounded-md border-l-4 p-2 text-xs ${msg.kind === 'ok' ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
