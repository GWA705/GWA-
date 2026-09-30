'use client';

import { useRef, useState, useTransition } from 'react';
import { fillMissingPostalsAction } from '@/app/(staff)/staff/leads/postalActions';

/**
 * "Fill missing postal codes" — looks up the postal for scanned leads that have
 * an address but no postal, using Google, and writes it back so leads route by
 * area. Only confident (real street-level) matches are written; a city-only or
 * OCR-mangled address is left blank rather than stamped with a wrong postal.
 *
 * Cursor-paged like the booking sweep, so a big backlog never blocks one long
 * request. Run it BEFORE sending scans to booking — booking won't overwrite a
 * lead already on the board, so the postal has to be there first.
 */

interface Totals { processed: number; filled: number; blank: number; failed: number }
const ZERO: Totals = { processed: 0, filled: 0, blank: 0, failed: 0 };
const MAX_CHUNKS = 5000; // safety stop for the loop

export function PostalFillButton() {
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
        const state = await fillMissingPostalsAction(cursor);
        if (state.error) { setError(state.error); return; }
        const r = state.result;
        if (r) {
          acc.processed += r.processed; acc.filled += r.filled; acc.blank += r.blank; acc.failed += r.failed;
          setTotals({ ...acc });
        }
        if (state.result?.done || stop.current) { setDone(true); return; }
        cursor = state.result?.lastId;
      }
      setDone(true);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Fill missing postal codes</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Looks up the postal from each scanned lead’s address (confident street matches only — vague
            addresses stay blank, never guessed). Run this before sending scans to booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending && (
            <button type="button" onClick={() => { stop.current = true; }} className="text-xs text-gray-500 hover:underline">
              Stop
            </button>
          )}
          <button type="button" onClick={run} className="btn-secondary text-xs" disabled={pending}>
            {pending ? 'Looking up…' : 'Fill postal codes'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border-l-4 border-amber-500 bg-amber-50 p-2 text-xs text-amber-800">{error}</p>
      )}

      {totals && !error && (
        <p className={`mt-3 rounded border-l-4 p-2 text-xs ${done ? 'border-green-500 bg-green-50 text-green-800' : 'border-blue-400 bg-blue-50 text-blue-800'}`}>
          {done ? 'Done. ' : 'Looking up… '}
          Checked {totals.processed}: <strong>{totals.filled}</strong> filled, {totals.blank} left blank (address too vague)
          {totals.failed ? `, ${totals.failed} couldn’t be looked up — run it again` : ''}.
        </p>
      )}
    </div>
  );
}
