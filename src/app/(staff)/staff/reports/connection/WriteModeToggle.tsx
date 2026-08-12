'use client';

import { useTransition } from 'react';
import { setJournalWriteModeAction } from '../actions';

export function WriteModeToggle({ mode }: { mode: 'test' | 'live' }) {
  const [pending, start] = useTransition();

  const switchTo = (target: 'test' | 'live') => {
    if (target === mode) return;
    const msg =
      target === 'live'
        ? 'Switch NEW deal writes to the REAL live journal? New deals will be written to the live sheet from now on.'
        : 'Switch NEW deal writes back to the TEST journal?';
    if (!window.confirm(msg)) return;
    start(() => setJournalWriteModeAction(target));
  };

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      {(['test', 'live'] as const).map((m) => (
        <button
          key={m}
          type="button"
          disabled={pending}
          onClick={() => switchTo(m)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
            mode === m
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
  );
}
