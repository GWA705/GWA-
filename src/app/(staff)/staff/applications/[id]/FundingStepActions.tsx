'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { markFundedAction, syncDealFromJournalAction } from '@/app/(staff)/actions';

/**
 * "Mark Funded" right inside the Awaiting-funding step, so the reviewer can mark
 * it here instead of going up to the status menu. Logs the funded date via the
 * status history. Also offers "Check journal now" — reads the deal's journal row
 * and, if it shows OK + a Date Paid, marks it Funded (& Paid) automatically. A
 * scheduled sweep does the same on its own; this is the manual trigger.
 */
export function FundingStepActions({
  applicationId,
  journalCheckedAt,
}: {
  applicationId: string;
  journalCheckedAt?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marked, setMarked] = useState(false); // optimistic: flip instantly on tap
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();

  function mark() {
    setError(null);
    setMessage(null);
    setMarked(true); // instant feedback — don't wait for the round-trip
    start(async () => {
      const res = await markFundedAction(applicationId);
      if (res?.error) {
        setMarked(false); // roll back on failure
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function checkJournal() {
    setError(null);
    setMessage(null);
    startCheck(async () => {
      const res = await syncDealFromJournalAction(applicationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setMessage(res.message ?? 'Checked.');
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={mark}
          disabled={pending || checking || marked}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-70"
        >
          {marked ? '✓ Funded' : '✓ Mark Funded'}
        </button>
        <button
          type="button"
          onClick={checkJournal}
          disabled={pending || checking}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
          title="Read this deal's row from the sales journal — if it's marked OK and paid, this advances it to Funded & Paid."
        >
          {checking ? 'Checking…' : '↻ Check journal now'}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Logs the funded date and moves the deal to <strong>Pay dealer</strong>. The portal also checks the journal on a
        schedule — when the journal shows this deal <strong>OK &amp; paid</strong>, it fills in Funded &amp; Paid on its
        own.
      </p>
      {message && <p className="mt-1 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {journalCheckedAt && !message && (
        <p className="mt-1 text-[11px] text-gray-400">Journal last checked {new Date(journalCheckedAt).toLocaleString('en-CA')}.</p>
      )}
    </div>
  );
}
