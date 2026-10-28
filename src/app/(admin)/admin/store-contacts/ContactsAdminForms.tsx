'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { importContactsAction, saveNationalRecipientsAction, type ContactsActionState } from './actions';

// Pending state comes from useFormStatus (must render inside the <form>).
// NOTE: React 18 has no useActionState — use useFormState/useFormStatus.
function SubmitButton({ idle, busy, disabled, className }: { idle: string; busy: string; disabled?: boolean; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? busy : idle}
    </button>
  );
}

export function ImportContactsForm() {
  const [state, action] = useFormState<ContactsActionState, FormData>(importContactsAction, {});
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const router = useRouter();
  // After a successful import, re-fetch the server data so the national
  // recipients box, the store list and the counts update without a manual reload.
  useEffect(() => { if (state?.ok) router.refresh(); }, [state?.ok, router]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ''));
    reader.onerror = () => setFileName(`Could not read ${f.name}`);
    reader.readAsText(f);
  }

  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-gray-500">Upload your store‑contacts sheet (saved/exported as <strong>CSV</strong>), or paste it below. Every store is matched by its 7xxx number and <strong>upserted</strong> — existing stores are updated, new ones added; your in‑portal edits to stores not in the file are left alone. Districts are pre‑filled where known.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={onFile} />
          Choose CSV file…
        </label>
        {fileName && <span className="text-xs text-gray-500">{fileName} — review below, then Import</span>}
      </div>
      <textarea name="csv" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="…or paste CSV here" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono" />
      <div className="flex items-center gap-3">
        <SubmitButton idle="Import CSV" busy="Importing…" disabled={!csv.trim()} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50" />
        {state?.ok && <span className="text-sm text-green-600">✓ {state.summary}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function NationalRecipientsForm({ initial }: { initial: string }) {
  const [state, action] = useFormState<ContactsActionState, FormData>(saveNationalRecipientsAction, {});
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-gray-500">Who the <strong>National weekly summary</strong> goes to (comma or line separated).</p>
      <textarea name="national" defaultValue={initial} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
      <div className="flex items-center gap-3">
        <SubmitButton idle="Save national list" busy="Saving…" className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50" />
        {state?.ok && <span className="text-sm text-green-600">✓ {state.summary}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
