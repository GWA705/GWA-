'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendReviewRequestAction, setCustomerEmailAction, setReviewLinkAction, sendReviewTestAction } from '@/app/(staff)/actions';

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
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState(customerEmail);
  const [emailDraft, setEmailDraft] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [alsoText, setAlsoText] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const hasEmail = !!email.trim();
  const when = sentAt
    ? new Date(sentAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const viaLabel = sentVia ? sentVia.replace('email', 'email').replace('sms', 'text').replace('+', ' + ') : '';

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
      setMsg({ kind: 'ok', text: r.note ? r.note : 'Review request sent — thank-you on its way! ⭐' });
      router.refresh();
    });
  }

  function sendTest() {
    setMsg(null);
    start(async () => {
      const r = await sendReviewTestAction();
      if (r.error) { setMsg({ kind: 'err', text: r.error }); return; }
      setMsg({ kind: 'ok', text: `Test sent to ${r.sentTo} — check your inbox (and spam).${r.note ? ' ' + r.note : ''}` });
    });
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">⭐</span>
        <h3 className="text-sm font-semibold text-gray-900">Ask the customer for a review</h3>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">
        Had a great call? Send a friendly link so the customer can leave Georgian Water &amp; Air a quick review.
      </p>
      <button
        type="button"
        onClick={sendTest}
        disabled={pending}
        className="mt-1.5 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
      >
        ✉ Send me a test email
      </button>

      {sentAt && (
        <p className="mt-2 rounded-md border-l-4 border-green-500 bg-green-50 p-2 text-xs text-green-800">
          Last sent {when}{sentByName ? ` by ${sentByName}` : ''}{viaLabel ? ` · via ${viaLabel}` : ''}.
        </p>
      )}

      {/* No review link configured yet */}
      {!reviewLinkSet ? (
        canManageLink ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <label className="block text-xs font-medium text-amber-900">Set the review link (one-time, applies to all deals)</label>
            <p className="mb-2 text-[11px] text-amber-700">Paste your Google-review landing page link. Starts with https://</p>
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
                {pending ? 'Saving…' : 'Save link'}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-gray-50 p-2 text-xs text-gray-500">
            A review link hasn’t been set up yet. An admin can add it here the first time.
          </p>
        )
      ) : (
        <>
          {/* Customer email row */}
          <div className="mt-3 text-sm">
            {hasEmail && !editingEmail ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Email:</span>
                <span className="font-medium text-gray-800">{email}</span>
                <button type="button" onClick={() => { setEditingEmail(true); setEmailDraft(email); }} className="text-xs text-brand-700 hover:underline">
                  change
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <label className="block text-xs font-medium text-gray-700">
                  {hasEmail ? 'Update customer email' : 'No email on file — add one to email the review link'}
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
                    {pending ? 'Saving…' : 'Save'}
                  </button>
                  {hasEmail && (
                    <button type="button" onClick={() => setEditingEmail(false)} className="px-2 py-1.5 text-sm text-gray-500 hover:underline">
                      cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Also-text option */}
          <label className={`mt-3 flex items-center gap-2 text-sm ${smsConfigured ? 'text-gray-700' : 'text-gray-400'}`}>
            <input
              type="checkbox"
              checked={alsoText}
              disabled={!smsConfigured}
              onChange={(e) => setAlsoText(e.target.checked)}
            />
            Also text {customerPhone || 'the customer'}
            {!smsConfigured && <span className="text-xs">(texting not set up yet)</span>}
          </label>

          {/* Send */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={send}
              disabled={pending || (!hasEmail && !alsoText)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Sending…' : sentAt ? 'Send review request again' : 'Send review request'}
            </button>
            {!hasEmail && !alsoText && (
              <span className="text-xs text-gray-400">Add an email (or enable text) to send.</span>
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
