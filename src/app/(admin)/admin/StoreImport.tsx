'use client';

import { useState, useTransition } from 'react';
import { importHomeDepotStoresAction } from '@/app/(admin)/actions';

/**
 * One-click import of the acquired Home Depot stores and their dealers.
 * Idempotent — re-running never creates duplicates.
 */
export function StoreImport() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; message?: string; error?: string } | null>(null);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Import HD stores</h2>
          <p className="text-sm text-gray-500">
            Create the acquired dealers and attach their Home Depot stores. Safe to re-run.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={pending}
          onClick={() => start(async () => setResult(await importHomeDepotStoresAction()))}
        >
          {pending ? 'Importing…' : 'Import HD stores'}
        </button>
      </div>
      {result?.ok && result.message && (
        <p className="mt-3 rounded bg-green-50 p-2 text-sm text-green-700">{result.message}</p>
      )}
      {result?.error && (
        <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">{result.error}</p>
      )}
    </div>
  );
}
