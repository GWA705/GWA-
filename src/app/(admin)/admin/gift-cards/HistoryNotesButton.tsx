'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GiftCardThread, type GiftCardNoteVM } from '@/components/GiftCardThread';
import { addStaffGiftCardNoteAction, markGiftCardReviewedAction } from './actions';

/**
 * The notes thread for ONE gift-card request in the History table — a button
 * that opens the full back-and-forth as an overlay, so a note is ALWAYS
 * viewable (and repliable) even after the card is sent. A red dot marks a card
 * with a new, unreviewed dealer note; opening it clears that flag.
 */
export function HistoryNotesButton({
  id,
  customerName,
  dealerName,
  notes,
  staffUnread,
}: {
  id: string;
  customerName: string;
  dealerName: string;
  notes: GiftCardNoteVM[];
  staffUnread: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, start] = useTransition();

  function openThread() {
    setOpen(true);
    if (staffUnread) {
      // Reading it counts as reviewing it — clear the "new" flag.
      start(async () => {
        await markGiftCardReviewedAction(id);
        router.refresh();
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openThread}
        className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${staffUnread ? 'text-red-600' : 'text-brand-600'}`}
      >
        {staffUnread && <span className="h-2 w-2 rounded-full bg-red-500" aria-label="New message" />}
        💬 {notes.length > 0 ? notes.length : ''} {notes.length === 1 ? 'note' : 'notes'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="card mt-10 w-full max-w-lg p-4 sm:mt-0" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900">
                {customerName} · <span className="text-gray-500">{dealerName}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 underline">close</button>
            </div>
            <GiftCardThread requestId={id} notes={notes} side="staff" addAction={addStaffGiftCardNoteAction} />
          </div>
        </div>
      )}
    </>
  );
}
