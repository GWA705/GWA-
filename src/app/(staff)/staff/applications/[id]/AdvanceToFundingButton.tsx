'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { advanceDealToInForFundingAction } from '@/app/(staff)/actions';

/**
 * "Move to In for funding" for a stuck deal (e.g. the out-of-band banner, or a
 * submitted deal). Enabled only when the uploaded funding docs are all confirmed;
 * otherwise it points the reviewer at the documents to confirm first.
 */
export function AdvanceToFundingButton({ applicationId, ready }: { applicationId: string; ready: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move() {
    setError(null);
    start(async () => {
      const res = await advanceDealToInForFundingAction(applicationId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  if (!ready) {
    return (
      <p className="mt-3 text-xs font-medium text-red-800">
        Confirm the uploaded documents under <strong>Funding documents</strong> below, then this deal can move to In
        for funding.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={move}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-70"
      >
        {pending ? 'Moving…' : 'Move to In for funding'}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
