'use client';

import { useRef, useState, useTransition } from 'react';
import { backfillSoldCustomersToBookingAction } from '@/app/(staff)/staff/leads/backfillActions';

/**
 * "Send sold customers to booking" — a one-time sweep of the deals that funded
 * before the booking sold-customer feed was switched on, so every historical
 * sold customer lands on the booking app's customer list / household. From then
 * on a deal pushes itself the moment it funds.
 *
 * Drives the server action chunk by chunk (cursor-paged) to the end, so a big
 * backlog never blocks one long request, and shows a running tally. Safe to run
 * again: booking dedupes a customer by phone and by the portal deal id, so
 * anything already sent comes back MERGED and is never doubled. Leadership only.
 */

interface Totals { sent: number; created: number; merged: number; skipped: number; failed: number }
const ZERO: Totals = { sent: 0, created: 0, merged: 0, skipped: 0, failed: 0 };
const MAX_CHUNKS = 2000; // safety stop for the loop

export function BackfillSoldButton() {
  const [pending, startTransition] = useTransition();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stop = useRef(false);

  function run() {
    setError(null);
    setDone(false);
    stop.current = false;
    const acc: Totals = { ...ZERO };
    setTotals({ ...acc });
    startTransition(async () => {
      let cursor: string | null | undefined = undefined;
      for (let i = 0; i < MAX_CHUNKS; i += 1) {
        const state = await backfillSoldCustomersToBookingAction(cursor);
        if (state.error) { setError(state.error); return; }
        const r = state.result;
        if (r) {
          acc.sent += r.sent; acc.created += r.created; acc.merged += r.merged;
          acc.skipped += r.skipped; acc.failed += r.failed;
          setTotals({ ...acc });
        }
        if (state.done || stop.current) { setDone(true); return; }
        cursor = state.lastId;
      }
      setDone(true);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Send sold customers to booking</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            One-time catch-up: send every already-funded deal to the booking system as a customer.
            New sales go over automatically. Safe to run again — nobody is doubled.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending && (
            <button type="button" onClick={() => { stop.current = true; }} className="text-xs text-gray-500 hover:underline">
              Stop
            </button>
          )}
          <button type="button" onClick={run} className="btn-secondary text-xs" disabled={pending}>
            {pending ? 'Sending…' : 'Send sold customers'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border-l-4 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800">{error}</p>
      )}

      {totals && !error && (
        <p className={`mt-3 rounded border-l-4 p-2 text-xs ${done ? 'border-green-500 bg-green-50 text-green-800' : 'border-blue-400 bg-blue-50 text-blue-800'}`}>
          {done ? 'Done. ' : 'Sending… '}
          Sent {totals.sent}: <strong>{totals.created}</strong> new in booking, {totals.merged} already there
          {totals.skipped ? `, ${totals.skipped} skipped` : ''}
          {totals.failed ? `, ${totals.failed} failed` : ''}.
        </p>
      )}
    </div>
  );
}
