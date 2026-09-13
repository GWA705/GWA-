'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { importVocAction } from '../actions';

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={pending}>
      {pending ? 'Importing…' : 'Import VOC file'}
    </button>
  );
}

/**
 * Admin control to upload a Home Depot VOC export (.xlsx). Upserts by Lead #, so
 * re-uploading a fuller month is safe.
 */
export function VocUpload() {
  const [state, action] = useFormState(importVocAction, {} as { ok?: boolean; error?: string; message?: string });
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <input
        type="file"
        name="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
      />
      <SubmitBtn />
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.message && <span className="text-sm font-medium text-green-700">{state.message}</span>}
    </form>
  );
}
