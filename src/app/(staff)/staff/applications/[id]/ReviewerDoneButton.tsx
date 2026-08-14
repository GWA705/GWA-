'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleReviewerDoneAction } from '@/app/(staff)/actions';

/**
 * "My paperwork is done" marker for the awaiting-install step. A team signal —
 * turns the step green and records who/when — that never moves the deal status
 * (the deal still advances on its own when the dealer sends the package back).
 */
export function ReviewerDoneButton({
  applicationId,
  doneAt,
  doneByName,
}: {
  applicationId: string;
  doneAt: string | null;
  doneByName: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const done = !!doneAt;

  function toggle() {
    start(async () => {
      await toggleReviewerDoneAction(applicationId);
      router.refresh();
    });
  }

  const when = doneAt
    ? new Date(doneAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3 ${
        done ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
          done ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {pending ? 'Saving…' : done ? '✓ Completed — tap to undo' : '✓ Mark my paperwork complete'}
      </button>
      {done ? (
        <span className="text-xs font-medium text-green-800">
          Completed{doneByName ? ` by ${doneByName}` : ''}{when ? ` · ${when}` : ''}
        </span>
      ) : (
        <span className="text-xs text-gray-500">Marks your side done — the status still waits on the dealer.</span>
      )}
    </div>
  );
}
