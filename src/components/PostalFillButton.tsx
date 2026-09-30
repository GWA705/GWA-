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

// Google's literal error text, when we carried one back (raw looks like
// "geocode_status_REQUEST_DENIED: <the message>"). Surfaced verbatim because the
// wording is what distinguishes the sub-cases (wrong key, wrong project, referrer
// restriction, not-yet-propagated).
function googleMessage(raw: string): string | null {
  const m = /geocode_status_[A-Z_]+:\s*(.+)$/i.exec(raw || '');
  const msg = m?.[1]?.trim();
  return msg && msg.length > 1 ? msg : null;
}

// Turn Google's raw status into a one-line, actionable explanation for the admin.
function explainFailure(raw: string): string {
  const r = raw || '';
  const g = googleMessage(r);
  const exact = g ? ` — Google’s exact words: “${g}”` : '';
  if (/REQUEST_DENIED/i.test(r)) {
    return 'Google rejected every request (REQUEST_DENIED). Usual causes: the ' +
      '“Geocoding API” isn’t allowed on the key the SERVER uses (check the key’s API ' +
      'restrictions), the server’s key belongs to a different Google Cloud project than ' +
      'the one you enabled Geocoding on, or the change hasn’t propagated yet (give it up ' +
      'to 5 minutes). Confirm the key the portal uses is the exact one you edited' + exact + '.';
  }
  if (/OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(r)) {
    return 'Google returned a quota/billing limit (OVER_QUERY_LIMIT). Check that ' +
      'billing is enabled on the Google Cloud project and the daily cap isn’t exceeded, then retry' + exact + '.';
  }
  if (/INVALID_REQUEST/i.test(r)) {
    return 'Google returned INVALID_REQUEST for the lookups — likely a malformed address' + exact + '.';
  }
  if (/geocode_http_/i.test(r)) {
    return 'The request to Google failed at the network level (HTTP error). This is usually ' +
      'transient — try again; if it persists the server may be blocked from reaching Google.';
  }
  if (/no GOOGLE_MAPS_API_KEY|geocode_unavailable/i.test(r)) {
    return 'No Google Maps API key is configured on the server (GOOGLE_MAPS_API_KEY).';
  }
  return `Google returned: ${r}`;
}

export function PostalFillButton() {
  const [pending, startTransition] = useTransition();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stop = useRef(false);

  function run() {
    setError(null);
    setReason(null);
    setDone(false);
    stop.current = false;
    const acc: Totals = { ...ZERO };
    setTotals({ ...acc });
    startTransition(async () => {
      let cursor: string | null | undefined = undefined;
      let firstReason: string | null = null;
      for (let i = 0; i < MAX_CHUNKS; i += 1) {
        const state = await fillMissingPostalsAction(cursor);
        if (state.error) { setError(state.error); return; }
        const r = state.result;
        if (r) {
          acc.processed += r.processed; acc.filled += r.filled; acc.blank += r.blank; acc.failed += r.failed;
          setTotals({ ...acc });
          if (!firstReason && r.failReason) { firstReason = r.failReason; setReason(explainFailure(r.failReason)); }
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
          {totals.failed ? `, ${totals.failed} couldn’t be looked up` : ''}.
        </p>
      )}

      {reason && (
        <p className="mt-2 rounded border-l-4 border-red-500 bg-red-50 p-2 text-xs text-red-800">
          <strong>Why the lookups failed:</strong> {reason}
        </p>
      )}
    </div>
  );
}
