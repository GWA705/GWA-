'use client';

import { useActionState } from 'react';
import { importContactsAction, saveNationalRecipientsAction, type ContactsActionState } from './actions';

export function ImportContactsForm() {
  const [state, action, pending] = useActionState<ContactsActionState, FormData>(importContactsAction, {});
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-gray-500">Paste the GWA store‑contacts sheet (CSV). Every store is matched by its 7xxx number and upserted — existing stores are updated, new ones added. Districts are pre‑filled where known.</p>
      <textarea name="csv" rows={5} placeholder="Paste CSV here…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50">{pending ? 'Importing…' : 'Import CSV'}</button>
        {state?.ok && <span className="text-sm text-green-600">✓ {state.summary}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function NationalRecipientsForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<ContactsActionState, FormData>(saveNationalRecipientsAction, {});
  return (
    <form action={action} className="space-y-2">
      <p className="text-sm text-gray-500">Who the <strong>National weekly summary</strong> goes to (comma or line separated).</p>
      <textarea name="national" defaultValue={initial} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50">{pending ? 'Saving…' : 'Save national list'}</button>
        {state?.ok && <span className="text-sm text-green-600">✓ {state.summary}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
