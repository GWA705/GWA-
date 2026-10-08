'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { findDealsForCaseAction, linkCaseToDealAction, type DealCandidate } from './actions';

/**
 * "Link this case to a deal" — shown when a case isn't attached to a customer's
 * deal yet. Linking a deal is what turns on Notify office + the deal's documents.
 * On open it auto-suggests the customer's deals (matched by phone + name); a
 * search box finds others by name or phone.
 */
export function LinkDealControl({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [deals, setDeals] = useState<DealCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();

  async function load(query?: string) {
    setLoading(true); setErr(null);
    try {
      const r = await findDealsForCaseAction(caseId, query);
      if (r.error) { setErr(r.error); setDeals([]); }
      else setDeals(r.deals ?? []);
    } catch { setErr('Couldn’t search deals — try again.'); setDeals([]); }
    finally { setLoading(false); }
  }

  function openPanel() {
    setOpen(true);
    if (deals === null) void load(); // auto-suggest on first open
  }

  function link(applicationId: string) {
    start(async () => {
      const r = await linkCaseToDealAction(caseId, applicationId);
      if (r.error) setErr(r.error);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-2 border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">Not linked to a deal.</span> Link it to turn on Notify office + the customer’s documents.
        </div>
        <button type="button" onClick={openPanel} className="btn-secondary shrink-0 text-sm">🔗 Link to a deal</button>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">🔗 Link this case to a deal</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void load(q); }}
        className="flex gap-2"
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone…"
          className="input flex-1"
          autoComplete="off"
        />
        <button type="submit" className="btn-secondary shrink-0 text-sm" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {deals === null ? null : deals.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {loading ? 'Searching…' : 'No deals found. Try the customer’s name or phone number.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {!q && <li className="text-xs text-gray-400 dark:text-slate-500">Suggested for this customer:</li>}
          {deals.map((d) => (
            <li key={d.applicationId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 p-2.5 dark:border-slate-700">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">{d.name || 'Unnamed customer'}</div>
                <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                  🏬 {d.office} · {d.statusLabel}{d.reference ? ` · HD #${d.reference}` : ''} · {d.date}
                </div>
              </div>
              <button type="button" onClick={() => link(d.applicationId)} className="btn-secondary shrink-0 text-sm">Link</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
