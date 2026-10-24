'use client';

import { useState, useTransition } from 'react';
import {
  approveUserRequestItemAction,
  rejectUserRequestItemAction,
  resendWelcomeForRequestItemAction,
} from '@/app/(admin)/actions';

export function ItemActions({
  itemId,
  email,
  alreadyHasLogin = false,
}: {
  itemId: string;
  email: string;
  alreadyHasLogin?: boolean;
}) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Set when a resend needs confirming (the person already signed in → reset).
  const [confirmResend, setConfirmResend] = useState<string | null>(null);

  function approve() {
    start(async () => {
      const res = await approveUserRequestItemAction(itemId, lang);
      setMsg({ ok: !!res.ok, text: res.message || res.error || '' });
    });
  }

  function resend(confirmReset = false) {
    start(async () => {
      const res = await resendWelcomeForRequestItemAction(itemId, lang, confirmReset);
      if (res.needsConfirm) {
        setConfirmResend(res.error || 'This person has already signed in — resending resets their password. Continue?');
        return;
      }
      setConfirmResend(null);
      setMsg({ ok: !!res.ok, text: res.message || res.error || '' });
    });
  }

  function reject() {
    const fd = new FormData();
    fd.set('itemId', itemId);
    fd.set('reason', reason);
    start(async () => {
      const res = await rejectUserRequestItemAction({}, fd);
      if (res.error) setMsg({ ok: false, text: res.error });
      else setRejecting(false);
    });
  }

  // After a decision, show the result (which may carry a temporary password to
  // share when email is off) as a persistent, copyable note.
  if (msg?.ok) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-2 text-xs text-green-800">
        {msg.text}
      </div>
    );
  }

  if (rejecting) {
    return (
      <div className="flex flex-col items-end gap-2">
        <input
          className="input h-8 w-56 text-xs"
          placeholder="Reason (optional, shown to dealer)"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button type="button" disabled={pending} className="btn-danger text-xs" onClick={reject}>
            {pending ? 'Declining…' : 'Confirm decline'}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  // The resend would reset an already-active password — confirm first.
  if (confirmResend) {
    return (
      <div className="flex max-w-xs flex-col items-end gap-2">
        <span className="text-right text-xs text-amber-700">{confirmResend}</span>
        <div className="flex gap-2">
          <button type="button" disabled={pending} className="btn-danger text-xs" onClick={() => resend(true)}>
            {pending ? 'Sending…' : 'Reset & resend'}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={() => setConfirmResend(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {alreadyHasLogin && (
        <span className="text-xs font-medium text-amber-700" title={`${email} already has a login`}>
          Already has a login
        </span>
      )}
      <div className="flex items-center gap-2">
        <select
          aria-label="Invite email language"
          className="input h-8 w-28 text-xs"
          value={lang}
          onChange={(e) => setLang(e.target.value as 'en' | 'fr')}
          title="Language of the welcome/login email"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>
        {alreadyHasLogin ? (
          <button type="button" disabled={pending} className="btn-primary text-xs" onClick={() => resend(false)} title="Re-send this person their getting-started email">
            {pending ? 'Sending…' : 'Resend welcome email'}
          </button>
        ) : (
          <button type="button" disabled={pending} className="btn-primary text-xs" onClick={approve}>
            {pending ? 'Creating…' : 'Approve & create'}
          </button>
        )}
        <button type="button" disabled={pending} className="btn-secondary text-xs" onClick={() => setRejecting(true)}>
          Decline
        </button>
      </div>
      {msg && !msg.ok && <span className="text-xs text-red-600">{msg.text}</span>}
    </div>
  );
}
