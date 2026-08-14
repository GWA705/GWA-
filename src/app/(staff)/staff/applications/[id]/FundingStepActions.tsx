'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { markFundedAction } from '@/app/(staff)/actions';

/**
 * "Mark Funded" right inside the Awaiting-funding step, so the reviewer can mark
 * it here instead of going up to the status menu. Logs the funded date via the
 * status history. Recording a payout (Pay dealer, below) also marks it funded
 * automatically, so a deal paid before anyone clicked here still advances.
 */
export function FundingStepActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function mark() {
    setError(null);
    start(async () => {
      const res = await markFundedAction(applicationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={mark}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Marking…' : '✓ Mark Funded'}
      </button>
      <p className="mt-2 text-xs text-gray-500">
        Logs the funded date and moves the deal to <strong>Pay dealer</strong>. Already paid by the funder? Skip straight
        to <strong>Pay dealer</strong> below and record the payout — that marks it Funded automatically.
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
