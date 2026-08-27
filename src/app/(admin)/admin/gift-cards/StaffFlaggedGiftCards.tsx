'use client';

import { useFormStatus } from 'react-dom';
import { GiftCardThread, type GiftCardNoteVM } from '@/components/GiftCardThread';
import { addStaffGiftCardNoteAction, unsendGiftCardAction } from './actions';

export interface FlaggedCard {
  id: string;
  dealerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  amount: number;
  status: string;
  sentAt: string | null;
  notes: GiftCardNoteVM[];
}

function ReopenBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary text-xs" disabled={pending}>
      {pending ? 'Reopening…' : '↩ Reopen to re-send'}
    </button>
  );
}

export function StaffFlaggedGiftCards({ flagged }: { flagged: FlaggedCard[] }) {
  if (flagged.length === 0) return null;
  return (
    <div className="card border-amber-200 bg-amber-50/40 p-4">
      <h2 className="text-base font-semibold text-gray-900">Needs attention</h2>
      <p className="mt-0.5 text-sm text-gray-600">
        A dealer messaged or corrected these already-sent cards (e.g. wrong email). Reply, then reopen to re-send if
        needed.
      </p>
      <ul className="mt-3 space-y-3">
        {flagged.map((c) => (
          <li key={c.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">
                  {c.customerName} <span className="font-normal text-gray-500">· {c.dealerName}</span>
                </div>
                <div className="truncate text-sm text-gray-600">{c.customerEmail}</div>
                {c.customerPhone && <div className="text-xs text-gray-500">📱 {c.customerPhone}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular-nums font-medium text-gray-900">${c.amount}</div>
                {c.status === 'SENT' && c.sentAt && (
                  <div className="text-[11px] text-gray-500">Sent {c.sentAt}</div>
                )}
              </div>
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2">
              <GiftCardThread requestId={c.id} notes={c.notes} side="staff" addAction={addStaffGiftCardNoteAction} />
            </div>
            {c.status === 'SENT' && (
              <form action={unsendGiftCardAction.bind(null, c.id)} className="mt-2">
                <ReopenBtn />
                <span className="ml-2 text-[11px] text-gray-400">Puts it back in the pending queue so you can re-send in Guusto.</span>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
