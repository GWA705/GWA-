'use client';

import { useState, useTransition } from 'react';
import { acknowledgeAlertAction } from '@/app/(account)/actions';

export type DealerAlertItem = {
  id: string;
  title: string;
  body: string;
  linkUrl: string | null;
};

/**
 * A must-read pop-up for dealers. It blocks the page until the dealer presses X
 * (or "I've read this"), which records their acknowledgement. Multiple pending
 * alerts are shown one at a time. There is deliberately no click-outside or Esc
 * dismissal — the only way to close is to acknowledge.
 */
export function AlertModal({ alerts }: { alerts: DealerAlertItem[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const remaining = alerts.filter((a) => !dismissed.has(a.id));
  if (remaining.length === 0) return null;
  const current = remaining[0];

  function acknowledge() {
    const id = current.id;
    // Advance immediately for a snappy UI; persist in the background.
    setDismissed((prev) => new Set(prev).add(id));
    startTransition(() => {
      void acknowledgeAlertAction(id);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border-4 border-green-500 bg-white shadow-2xl">
        <button
          type="button"
          onClick={acknowledge}
          aria-label="Close and mark as read"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xl font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          ✕
        </button>
        <div className="p-6 pr-12">
          <h2 id="alert-title" className="text-2xl font-semibold text-gray-900">
            {current.title}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-gray-700">
            {current.body}
          </p>
          {current.linkUrl && (
            <a
              href={current.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Open link ↗
            </a>
          )}
          <div className="mt-6 flex items-center justify-between">
            {remaining.length > 1 ? (
              <span className="text-xs text-gray-400">
                {remaining.length} messages — 1 shown at a time
              </span>
            ) : (
              <span />
            )}
            <button type="button" onClick={acknowledge} className="btn-primary">
              I’ve read this
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
