'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProgramBadge } from '@/components/ProgramBadge';
import { markDealsFundedAction, type ReconcileCandidate } from '@/app/(staff)/actions';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtAmount(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-CA');
}

/**
 * Reviewed bulk "mark Funded" for legacy deals stuck at Approved/Conditional.
 * The admin ticks the ones that are really settled and marks them Funded in one
 * go; a deal blocked by the reference gate (missing HD # / financing number)
 * can't be selected and shows why. Two-step confirm — nothing changes on a
 * single click.
 */
export function ReconcileDealsTable({ deals }: { deals: ReconcileCandidate[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ funded: number; skipped: { name: string; reason: string }[] } | null>(null);

  const selectable = useMemo(() => deals.filter((d) => !d.blockedReason), [deals]);
  const allSelectableChecked = selectable.length > 0 && selectable.every((d) => selected.has(d.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setConfirming(false);
  }
  function toggleAll() {
    setConfirming(false);
    setSelected(allSelectableChecked ? new Set() : new Set(selectable.map((d) => d.id)));
  }

  function run() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setResult(null);
    start(async () => {
      const res = await markDealsFundedAction(ids);
      setResult(res);
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    });
  }

  const count = selected.size;

  if (deals.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-gray-500">
        No deals are sitting at Approved / Conditional right now — nothing to reconcile. 🎉
        {result && result.funded > 0 && (
          <p className="mt-2 font-medium text-emerald-700">Marked {result.funded} deal{result.funded === 1 ? '' : 's'} Funded.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        {!confirming ? (
          <button
            type="button"
            disabled={count === 0 || pending}
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Mark selected as Funded{count > 0 ? ` (${count})` : ''}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
            <span className="text-sm font-medium text-emerald-900">Mark {count} deal{count === 1 ? '' : 's'} as Funded?</span>
            <button type="button" disabled={pending} onClick={run} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {pending ? 'Working…' : 'Yes, mark Funded'}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">Cancel</button>
          </div>
        )}
        <span className="text-xs text-gray-500">{selectable.length} selectable · {deals.length - selectable.length} blocked</span>
      </div>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
          {result.funded > 0 && <p className="font-medium text-emerald-700">✓ Marked {result.funded} deal{result.funded === 1 ? '' : 's'} Funded. Now fill the sales journal as usual to mark them Paid.</p>}
          {result.skipped.length > 0 && (
            <div className="mt-1">
              <p className="font-medium text-amber-800">{result.skipped.length} skipped:</p>
              <ul className="ml-4 list-disc text-xs text-gray-600">
                {result.skipped.map((s, i) => <li key={i}><span className="font-medium">{s.name}</span> — {s.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={allSelectableChecked} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-3">Applicant</th>
              <th className="hidden px-3 py-3 sm:table-cell">Dealer</th>
              <th className="px-3 py-3">Program</th>
              <th className="px-3 py-3">Amount</th>
              <th className="hidden px-3 py-3 sm:table-cell">Sold</th>
              <th className="px-3 py-3">Entered</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map((d) => {
              const blocked = !!d.blockedReason;
              return (
                <tr key={d.id} className={blocked ? 'bg-amber-50/40' : selected.has(d.id) ? 'bg-emerald-50/50' : 'hover:bg-gray-50'}>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      aria-label={`Select ${d.name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/staff/applications/${d.id}`} className="font-medium text-brand-700 hover:underline">{d.name || '—'}</Link>
                    {blocked && <div className="mt-0.5 text-xs text-amber-800">{d.blockedReason}</div>}
                    <div className="mt-0.5 text-xs text-gray-500 sm:hidden">{d.dealerName}</div>
                  </td>
                  <td className="hidden px-3 py-3 text-gray-600 sm:table-cell">{d.dealerName}</td>
                  <td className="px-3 py-3"><ProgramBadge type={d.programType} /></td>
                  <td className="px-3 py-3 tabular-nums">{fmtAmount(d.amount)}</td>
                  <td className="hidden px-3 py-3 tabular-nums text-gray-500 sm:table-cell">{fmtDate(d.dateOfSale)}</td>
                  <td className="px-3 py-3 tabular-nums text-gray-500">{fmtDate(d.createdAt)}</td>
                  <td className="px-3 py-3 text-gray-600">{d.status === 'CONDITIONAL' ? 'Conditional' : 'Approved'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
