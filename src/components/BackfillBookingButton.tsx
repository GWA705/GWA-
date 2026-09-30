'use client';

import { useState, useTransition } from 'react';
import { backfillScannedLeadsToBookingAction, type BackfillState } from '@/app/(staff)/staff/leads/backfillActions';

/**
 * "Send existing scans to booking" — a one-time sweep of the scanned-lead backlog
 * onto the booking board. New scans push themselves as they're confirmed; this
 * catches up the ones saved before the feed went live.
 *
 * Safe to click more than once: booking dedupes on the lead id, so anything
 * already sent comes back as a duplicate and is never doubled. The button reports
 * exactly what happened so the run is visible, not a leap of faith.
 */
export function BackfillBookingButton() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BackfillState | null>(null);

  function run() {
    setState(null);
    startTransition(async () => {
      setState(await backfillScannedLeadsToBookingAction());
    });
  }

  const r = state?.result;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Send existing scans to booking</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            One-time catch-up of scanned leads saved before the booking feed went live. New scans go over
            on their own. Safe to run again — nothing is ever booked twice.
          </p>
        </div>
        <button type="button" onClick={run} className="btn-secondary text-xs" disabled={pending}>
          {pending ? 'Sending…' : 'Send existing scans'}
        </button>
      </div>

      {state?.error && (
        <p className="mt-3 rounded border-l-4 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800">{state.error}</p>
      )}

      {r && (
        <p className="mt-3 rounded border-l-4 border-green-500 bg-green-50 p-2 text-xs text-green-800">
          Sent {r.sent} scan{r.sent === 1 ? '' : 's'}: <strong>{r.created}</strong> newly on the board,{' '}
          {r.duplicate} already there{r.skipped ? `, ${r.skipped} skipped (do-not-call or unbookable)` : ''}
          {r.failed ? `, ${r.failed} couldn’t be sent — run it again` : ''}.
        </p>
      )}
    </div>
  );
}
