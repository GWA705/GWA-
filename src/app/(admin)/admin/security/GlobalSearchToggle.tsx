'use client';

import { useTransition } from 'react';
import { setGlobalSearchAction } from './actions';

export function GlobalSearchToggle({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-900">Global customer search</div>
        <div className="text-xs text-gray-500">
          {enabled ? 'On — staff can search all customers; dealers can find which office a customer belongs to.' : 'Off — no global customer search.'}
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!enabled && !window.confirm('Turn on global customer search? Dealers will be able to look up which office a customer belongs to (name/office/phone only). Every search is logged.')) return;
          start(() => setGlobalSearchAction(!enabled));
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-gray-300'} disabled:opacity-50`}
        aria-pressed={enabled}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
