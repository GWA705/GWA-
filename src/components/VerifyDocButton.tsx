'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleDocumentVerifiedAction } from '@/app/(staff)/actions';

/**
 * "Mark completed" toggle for a funding document. Flips to its new state
 * immediately (optimistic) while the server action runs in the background, so
 * the reviewer isn't left waiting on a round-trip for the button to turn green.
 * The optimistic value resets to the server's once revalidation lands.
 */
export function VerifyDocButton({ documentId, done }: { documentId: string; done: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done, (_prev, next: boolean) => next);
  const [, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      setOptimisticDone(!optimisticDone);
      await toggleDocumentVerifiedAction(documentId);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition ${
        optimisticDone
          ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100'
          : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
      }`}
      title={optimisticDone ? 'Mark as not completed' : 'View, then mark completed'}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${optimisticDone ? 'border-green-600 bg-green-600 text-white' : 'border-gray-400'}`}>
        {optimisticDone ? '✓' : ''}
      </span>
      {optimisticDone ? 'Completed' : 'Mark completed'}
    </button>
  );
}
