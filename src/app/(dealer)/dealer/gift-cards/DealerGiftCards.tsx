'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { GiftCardThread, type GiftCardNoteVM } from '@/components/GiftCardThread';
import { editGiftCardRequestAction, addGiftCardNoteAction, type GiftCardActionState } from './actions';
import { CancelGiftCardButton } from './CancelGiftCardButton';

export interface DealerRequestVM {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  amount: number;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  sentAt: string | null;
  dealerUnread: boolean;
  notes: GiftCardNoteVM[];
}

const money = (n: number) => `$${n.toLocaleString('en-CA', { maximumFractionDigits: 2 })}`;

function StatusBadge({ r }: { r: DealerRequestVM }) {
  if (r.status === 'SENT') {
    return (
      <div className="text-right">
        <span className="badge bg-green-100 text-green-800">✓ Sent</span>
        {r.sentAt && <div className="mt-0.5 text-[11px] text-gray-500">{r.sentAt}</div>}
      </div>
    );
  }
  if (r.status === 'CANCELLED') return <span className="badge bg-gray-100 text-gray-500">Cancelled</span>;
  return <span className="badge bg-amber-100 text-amber-800">Pending</span>;
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Saving…' : 'Save details'}
    </button>
  );
}

function EditForm({ r }: { r: DealerRequestVM }) {
  const [state, action] = useFormState(editGiftCardRequestAction, {} as GiftCardActionState);
  const ok = state.ok ? state.message : null;
  return (
    <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <input type="hidden" name="requestId" value={r.id} />
      <div>
        <label className="label text-xs">Customer name</label>
        <input name="customerName" defaultValue={r.customerName} className="input text-sm" />
      </div>
      <div>
        <label className="label text-xs">Customer email</label>
        <input name="customerEmail" type="email" defaultValue={r.customerEmail} className="input text-sm" />
      </div>
      <div>
        <label className="label text-xs">Customer cell (optional)</label>
        <input name="customerPhone" defaultValue={r.customerPhone ?? ''} placeholder="705-555-0123" className="input text-sm" />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <SaveBtn />
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        {ok && <span className="text-xs text-green-700">{ok}</span>}
      </div>
    </form>
  );
}

function RequestCard({ r }: { r: DealerRequestVM }) {
  const [open, setOpen] = useState(r.dealerUnread);
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {r.dealerUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="New update" />}
            <span className="font-medium text-gray-900">{r.customerName}</span>
          </div>
          <div className="truncate text-sm text-gray-600">{r.customerEmail}</div>
          {r.customerPhone && <div className="text-xs text-gray-500">📱 {r.customerPhone}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tabular-nums font-medium text-gray-900">{money(r.amount)}</span>
          <StatusBadge r={r} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-brand-600 hover:underline">
          {open ? 'Hide' : r.notes.length > 0 ? `Messages & edit (${r.notes.length})` : 'Messages & edit'}
        </button>
        {r.status === 'PENDING' && <CancelGiftCardButton id={r.id} />}
      </div>
      {open && (
        <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          {r.status !== 'CANCELLED' && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Fix the customer’s details</p>
              <EditForm r={r} />
              <p className="mt-1 text-[11px] text-gray-400">
                Wrong email or want it sent by text? Update it here — the team is notified to re-send.
              </p>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Messages</p>
            <GiftCardThread requestId={r.id} notes={r.notes} side="dealer" addAction={addGiftCardNoteAction} />
          </div>
        </div>
      )}
    </li>
  );
}

export function DealerGiftCards({ requests }: { requests: DealerRequestVM[] }) {
  if (requests.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-gray-500">No gift-card requests yet.</div>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {requests.map((r) => (
        <RequestCard key={r.id} r={r} />
      ))}
    </ul>
  );
}
