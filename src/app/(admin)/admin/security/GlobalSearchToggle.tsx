'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setGlobalSearchAction } from './actions';

export function GlobalSearchToggle({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    if (
      !enabled &&
      !window.confirm(
        'Turn on global customer search? Dealers will be able to look up which office a customer belongs to (name/office/phone only). Every search is logged.',
      )
    )
      return;
    setError(null);
    start(async () => {
      try {
        await setGlobalSearchAction(!enabled);
        // Re-fetch the server component so the switch reflects the saved state.
        router.refresh();
      } catch (e) {
        setError((e as Error)?.message || 'Could not save. Please try again.');
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-900">Global customer search</div>
        <div className="text-xs text-gray-500">
          {enabled
            ? 'On — staff can search all customers; dealers can find which office a customer belongs to.'
            : 'Off — no global customer search.'}
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-gray-300'} disabled:opacity-50`}
        aria-pressed={enabled}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
