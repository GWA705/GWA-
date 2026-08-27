'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { markGiftCardsSentAction, type GiftCardAdminState } from './actions';

export interface PendingCard {
  id: string;
  dealerName: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  requestedAt: string; // preformatted
}

function MarkSentBtn({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending || count === 0}>
      {pending ? 'Saving…' : `Mark ${count} sent`}
    </button>
  );
}

export function GiftCardQueue({ pending }: { pending: PendingCard[] }) {
  const [state, action] = useFormState(markGiftCardsSentAction, {} as GiftCardAdminState);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pending.map((p) => p.id)));
  const [copied, setCopied] = useState<string | null>(null);
  const [office, setOffice] = useState('');

  // Offices with a pending count, for the filter (mirrors the per-office groups).
  const offices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pending) counts.set(p.dealerName, (counts.get(p.dealerName) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pending]);

  const visible = useMemo(() => (office ? pending.filter((p) => p.dealerName === office) : pending), [pending, office]);
  const chosen = visible.filter((p) => selected.has(p.id));
  const allOn = chosen.length === visible.length && visible.length > 0;

  const emailsText = useMemo(() => chosen.map((c) => c.customerEmail).join('\n'), [chosen]);
  const csvText = useMemo(
    () => ['Name,Email,Amount', ...chosen.map((c) => `${c.customerName.replace(/,/g, ' ')},${c.customerEmail},${c.amount}`)].join('\n'),
    [chosen],
  );

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied('failed');
      setTimeout(() => setCopied(null), 1500);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) for (const p of visible) next.delete(p.id);
      else for (const p of visible) next.add(p.id);
      return next;
    });
  }

  if (pending.length === 0) {
    return <div className="card p-8 text-center text-sm text-gray-500">No pending gift cards — all caught up. 🎉</div>;
  }

  return (
    <div className="space-y-4">
      {/* Office filter — work one office at a time, like the per-office groups */}
      {offices.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="office" className="text-sm font-medium text-gray-700">Office:</label>
          <select
            id="office"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            className="input w-auto text-sm"
          >
            <option value="">All offices ({pending.length})</option>
            {offices.map(([name, count]) => (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            ))}
          </select>
          {office && (
            <button type="button" onClick={() => setOffice('')} className="text-xs text-gray-500 underline">
              clear
            </button>
          )}
        </div>
      )}

      {/* Copy area */}
      <div className="card border-sky-200 bg-sky-50/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Copy the {chosen.length} selected for Guusto:</span>
          <button type="button" onClick={() => copy(emailsText, 'emails')} className="btn-secondary text-xs">
            Copy emails
          </button>
          <button type="button" onClick={() => copy(csvText, 'csv')} className="btn-secondary text-xs">
            Copy CSV (name, email, amount)
          </button>
          {copied === 'emails' && <span className="text-xs text-green-700">✓ Emails copied</span>}
          {copied === 'csv' && <span className="text-xs text-green-700">✓ CSV copied</span>}
          {copied === 'failed' && <span className="text-xs text-red-600">Copy failed — select the box below</span>}
        </div>
        <textarea
          readOnly
          value={emailsText}
          rows={Math.min(6, Math.max(2, chosen.length))}
          className="input mt-2 w-full font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>

      {/* Queue + mark sent */}
      <form action={action}>
        {state.error && <div className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</div>}
        {state.ok && <div className="mb-2 rounded-md bg-green-50 p-2 text-sm text-green-700">{state.message}</div>}
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all" /></th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((c) => (
                <tr key={c.id} className={selected.has(c.id) ? 'bg-brand-50/40' : ''}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    {selected.has(c.id) && <input type="hidden" name="ids" value={c.id} />}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{c.customerEmail}</td>
                  <td className="px-4 py-3 text-gray-600">{c.dealerName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">${c.amount}</td>
                  <td className="px-4 py-3 text-gray-500">{c.requestedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <MarkSentBtn count={chosen.length} />
          <span className="text-xs text-gray-500">Marks them sent and shows each dealer a dated receipt.</span>
        </div>
      </form>
    </div>
  );
}
