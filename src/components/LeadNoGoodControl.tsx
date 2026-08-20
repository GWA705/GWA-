'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { markLeadNoGoodAction, unmarkLeadNoGoodAction } from '@/lib/leadNoGoodActions';

/**
 * "Mark No good" control for a single lead. Writes back to the HD Leads Log
 * Google Sheet (the source of truth). Marking requires a typed reason and an
 * explicit "Are you sure?" confirm; the person's login name is recorded in the
 * sheet. Staff can also reverse a No-Good flag.
 */
export function LeadNoGoodControl({
  rowId,
  bookingId,
  noGood,
  canUnmark,
}: {
  rowId: string;
  bookingId: string;
  noGood: boolean;
  // Staff may reverse a flag; dealers only set it.
  canUnmark: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Optimistic override: flip the UI instantly on click, then write to the
  // Google Sheet in the background. null = show the real (server) state.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const hasBooking = Boolean(bookingId);
  const showNoGood = optimistic ?? noGood;

  function submitMark() {
    const r = reason.trim();
    if (!r) {
      setError('Please enter a reason.');
      return;
    }
    setError(null);
    setOptimistic(true); // instant — show "Marked No good" right away
    setOpen(false);
    start(async () => {
      const res = await markLeadNoGoodAction({ rowId, bookingId, reason: r });
      if (res?.error) {
        setOptimistic(null); // roll back to the real state
        setOpen(true); // reopen with the reason still typed
        setError(res.error);
        return;
      }
      setReason('');
      router.refresh(); // reconcile with the server
    });
  }

  function submitUnmark() {
    setError(null);
    setOptimistic(false); // instant — restore to Forwarded right away
    start(async () => {
      const res = await unmarkLeadNoGoodAction({ rowId, bookingId });
      if (res?.error) {
        setOptimistic(null); // roll back
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (showNoGood) {
    return (
      <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Marked No good in the log
          </span>
          {pending && <span className="text-xs text-gray-400">saving…</span>}
          {canUnmark && (
            <button
              type="button"
              onClick={submitUnmark}
              disabled={pending || !hasBooking}
              className="text-xs font-medium text-gray-500 underline hover:text-gray-700 disabled:opacity-40"
            >
              Undo — restore to Forwarded
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-dashed border-gray-200 pt-3">
      {!open ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => { setOpen(true); setError(null); }}
            disabled={!hasBooking}
            title={hasBooking ? undefined : 'This lead has no booking ID, so it can’t be written back to the log.'}
            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ✕ Mark No good
          </button>
          <span className="text-xs text-gray-500">Flags the lead as unusable and notifies Home Depot.</span>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-sm font-semibold text-red-800">Mark this lead No good?</div>
          <p className="mt-0.5 text-xs text-red-700">
            This writes “No Good” back to the HD Leads Log and flags it to report to Home Depot. This will be logged and recorded. A reason is required.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Reason (e.g. wrong number, out of area, duplicate)…"
            className="input mt-2 w-full text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={submitMark}
              disabled={pending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Yes, mark No good'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setReason(''); setError(null); }}
              disabled={pending}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
