'use client';

import { useState, useTransition } from 'react';

/**
 * Small "Delete" affordance on a document row, for reviewers/admins to remove a
 * wrong file and re-upload. Confirms first; surfaces any server error inline.
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

  function onClick() {
    setError(null);
    if (!window.confirm(`Delete "${fileName}"? This can't be undone — you can upload a corrected file after.`)) return;
    start(async () => {
      const res = await action(documentId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <span className="flex flex-none items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
        title="Delete this file"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    </span>
  );
}
