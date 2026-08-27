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

  const chosen = pending.filter((p) => selected.has(p.id));
  const allOn = chosen.length === pending.length && pending.length > 0;

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
    setSelected(allOn ? new Set() : new Set(pending.map((p) => p.id)));
  }

  if (pending.length === 0) {
    return <div className="card p-8 text-center text-sm text-gray-500">No pending gift cards — all caught up. 🎉</div>;
  }

  return (
    <div className="space-y-4">
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
              {pending.map((c) => (
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
