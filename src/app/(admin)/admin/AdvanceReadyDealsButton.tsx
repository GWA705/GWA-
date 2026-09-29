'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { advanceReadyFundingDealsAction } from '@/app/(staff)/actions';

/**
 * One-click backlog cleanup for admins: advance every deal stuck at
 * "In-for-funding submitted" whose uploaded documents are all already confirmed
 * to "In for funding". Only shows when there is something to move.
 */
export function AdvanceReadyDealsButton({ readyCount }: { readyCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  if (readyCount === 0 && !result) {
    return <p className="text-sm text-gray-500">No deals are waiting to advance — the funding queue is clear.</p>;
  }

  function run() {
    if (!window.confirm(`Advance ${readyCount} deal${readyCount === 1 ? '' : 's'} to "In for funding"? Only deals whose documents are already confirmed will move. Nothing will be marked Funded.`)) {
      return;
    }
    setResult(null);
    start(async () => {
      const res = await advanceReadyFundingDealsAction();
      setResult(`Moved ${res.moved} deal${res.moved === 1 ? '' : 's'} to In for funding.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {readyCount > 0 && (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
        >
          {pending ? 'Advancing…' : `Advance ${readyCount} ready deal${readyCount === 1 ? '' : 's'} → In for funding`}
        </button>
      )}
      {result && <p className="text-sm font-medium text-emerald-700">{result}</p>}
      <p className="text-xs text-gray-500">
        Moves only deals sitting at <strong>In-for-funding submitted</strong> whose uploaded documents are all
        confirmed. It never marks a deal Funded — that still happens the normal way (reviewer, or the sales journal
        when it shows paid). Each move is logged.
      </p>
    </div>
  );
}
