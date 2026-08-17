'use client';

import { useState, useTransition } from 'react';

/**
 * Small "Delete" affordance on a document row, for reviewers/admins to remove a
 * wrong file and re-upload. Uses an in-app two-step confirm (reliable in the
 * installed PWA, where a native window.confirm can be suppressed); surfaces any
 * server error inline.
 */
export function DeleteDocumentButton({
  documentId,
  fileName,
  action,
}: {
  documentId: string;
  fileName: string;
  action: (id: string) => Promise<{ error?: string }>;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function doDelete() {
    setError(null);
    start(async () => {
      const res = await action(documentId);
      if (res?.error) {
        setError(res.error);
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex flex-none items-center gap-2">
        <span className="text-xs text-gray-600">Delete this file?</span>
        <button
          type="button"
          onClick={doDelete}
          disabled={pending}
          className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md px-2 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-none items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-gray-400 hover:text-red-600"
        title={`Delete ${fileName}`}
      >
        Delete
      </button>
    </span>
  );
}
