'use client';

import { useState, useTransition } from 'react';
import { approveUserRequestItemAction, rejectUserRequestItemAction } from '@/app/(admin)/actions';

export function ItemActions({ itemId, email }: { itemId: string; email: string }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function approve() {
    start(async () => {
      const res = await approveUserRequestItemAction(itemId);
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

  // After approval, show the result (which may carry a temporary password to
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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={pending} className="btn-primary text-xs" onClick={approve}>
          {pending ? 'Creating…' : 'Approve & create'}
        </button>
        <button type="button" disabled={pending} className="btn-secondary text-xs" onClick={() => setRejecting(true)}>
          Decline
        </button>
      </div>
      {msg && !msg.ok && <span className="text-xs text-red-600">{msg.text}</span>}
    </div>
  );
}
