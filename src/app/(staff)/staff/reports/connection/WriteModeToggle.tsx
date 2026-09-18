'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setJournalWriteModeAction } from '../actions';

export function WriteModeToggle({ mode }: { mode: 'test' | 'live' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Track the mode locally so the toggle flips immediately from the action's
  // result, rather than depending only on the page revalidating.
  const [current, setCurrent] = useState<'test' | 'live'>(mode);
  const [confirming, setConfirming] = useState<'test' | 'live' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = (target: 'test' | 'live') => {
    setConfirming(null);
    setError(null);
    start(async () => {
      const r = await setJournalWriteModeAction(target);
      if (r?.error) { setError(r.error); return; }
      setCurrent(r?.mode ?? target);
      router.refresh();
    });
  };

  // Inline confirmation for switching TO live (the money-sensitive direction) —
  // no window.confirm, which some in-app browsers silently block.
  if (confirming) {
    const toLive = confirming === 'live';
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="max-w-xs text-right text-xs text-gray-600">
          {toLive
            ? 'Switch NEW deal writes to the REAL live journal? New deals will go to the live sheet from now on.'
            : 'Switch NEW deal writes back to the TEST journal?'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(confirming)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${toLive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-900'}`}
          >
            {pending ? 'Switching…' : toLive ? 'Yes, go Live' : 'Yes, use Test'}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(null)} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {(['test', 'live'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => { if (m !== current) setConfirming(m); }}
            aria-pressed={current === m}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              current === m
                ? m === 'live'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {m === 'test' ? 'Test journal' : 'Live journal'}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
