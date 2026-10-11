'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { findCustomerDataAction, eraseCustomerDataAction } from '../actions';
import type { CustomerDataFound } from '@/lib/customerData';

function FindBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn-primary text-sm" disabled={pending}>{pending ? 'Searching…' : 'Look up'}</button>;
}
function EraseBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" disabled={pending}>{pending ? 'Erasing…' : 'Erase texting & lead data'}</button>;
}

export function DataRequestTool() {
  const [phone, setPhone] = useState('');
  const [findState, findAction] = useFormState(findCustomerDataAction, {} as { data?: CustomerDataFound; error?: string; notFound?: boolean });
  const [eraseState, eraseAction] = useFormState(eraseCustomerDataAction, {} as { ok?: boolean; error?: string; message?: string });
  const d = findState.data;

  return (
    <div className="space-y-4">
      <form action={findAction} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[220px] flex-1">
          <span className="label">Customer phone number</span>
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="705-555-0148" className="input" autoComplete="off" />
        </label>
        <FindBtn />
        {findState.error && <span className="pb-2 text-xs text-red-600">{findState.error}</span>}
        {findState.notFound && <span className="pb-2 text-xs text-gray-500">No records found for that number.</span>}
      </form>

      {eraseState.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{eraseState.message}</div>
      )}

      {d && !eraseState.ok && (
        <div className="card space-y-4 p-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">What we hold for •••{d.phoneLast10.slice(-4)}</h2>
            <p className="text-xs text-gray-500">Every lookup is logged.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-slate-50/60 p-3"><div className="text-xl font-bold tabular-nums">{d.texts}</div><div className="text-xs text-gray-500">Text records</div></div>
            <div className="rounded-lg border border-gray-200 bg-slate-50/60 p-3"><div className="text-xl font-bold tabular-nums">{d.replies}</div><div className="text-xs text-gray-500">Replies on file</div></div>
            <div className="rounded-lg border border-gray-200 bg-slate-50/60 p-3"><div className="text-xl font-bold tabular-nums">{d.leads.length}</div><div className="text-xs text-gray-500">Leads</div></div>
            <div className="rounded-lg border border-gray-200 bg-slate-50/60 p-3"><div className="text-sm font-semibold">{d.optedOut ? 'Opted out' : 'Active'}</div><div className="text-xs text-gray-500">Contact status</div></div>
          </div>

          {d.leads.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Leads (will be erased)</h3>
              <ul className="text-sm text-gray-700">
                {d.leads.map((l) => <li key={l.id}>{l.name || 'Unnamed'} · {l.createdAt}</li>)}
              </ul>
            </div>
          )}

          {(d.deals.length > 0 || d.cases.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium">Retained (not erased): {d.deals.length} deal{d.deals.length === 1 ? '' : 's'}{d.cases.length ? `, ${d.cases.length} HD case${d.cases.length === 1 ? '' : 's'}` : ''}.</div>
              <div className="mt-0.5 text-xs">Funded deals and HD cases are kept under financing/tax retention obligations (a PIPEDA exception). Handle those separately if a full erasure is required and permitted.</div>
            </div>
          )}

          <form action={eraseAction} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
            <input type="hidden" name="phone" value={phone} />
            <label className="min-w-[160px]">
              <span className="label">Type <code>ERASE</code> to confirm</span>
              <input name="confirm" placeholder="ERASE" className="input" autoComplete="off" />
            </label>
            <EraseBtn />
            {eraseState.error && <span className="pb-2 text-xs text-red-600">{eraseState.error}</span>}
          </form>
          <p className="text-[11px] text-gray-400">Erasing deletes the customer&rsquo;s text records and marketing leads, and keeps their number on the do-not-contact list. This cannot be undone.</p>
        </div>
      )}
    </div>
  );
}
