'use client';

import { useState } from 'react';
import { NON_FINANCED_SPLIT_METHODS, FINANCED_SPLIT_METHOD } from '@/lib/constants';
import { MAX_PAYMENT_SPLITS, totalFromSplits, toCents } from '@/lib/payments';
import type { PaymentMethod } from '@prisma/client';

interface OtherLine {
  key: string;
  method: PaymentMethod | '';
  amount: string;
}

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let seq = 0;
const newLine = (method: PaymentMethod | '' = '', amount = ''): OtherLine => ({ key: `l${seq++}`, method, amount });

/**
 * Split / multi-method payment entry. There is always one auto-filled "Financed"
 * line whose amount is the remainder of the deal total after the other payment
 * lines (down payments) are subtracted — so the split always balances to the
 * total and the dealer only types the extra lines. Which finance company + loan
 * number applies is set later by the reviewer at approval.
 *
 * Posts `isSplitPayment` plus repeated `splitMethod` / `splitAmount` fields
 * (financed line first), which the server reads with getAll().
 */
export function SplitPaymentInput({
  total,
  defaultOn = false,
  defaultSplits = [],
}: {
  total: number;
  defaultOn?: boolean;
  defaultSplits?: { method: PaymentMethod; amount: number }[];
}) {
  const financedValues = new Set(['FINANCEIT', 'FINANCE_COMPANY']);
  const initialOthers = defaultSplits.filter((s) => !financedValues.has(s.method));
  const [on, setOn] = useState(defaultOn);
  const [others, setOthers] = useState<OtherLine[]>(
    initialOthers.length > 0 ? initialOthers.map((s) => newLine(s.method, String(s.amount))) : [newLine()],
  );

  const othersParsed = others
    .filter((l) => l.method && Number(l.amount) > 0)
    .map((l) => ({ method: l.method as PaymentMethod, amount: Number(l.amount) }));
  const othersSum = totalFromSplits(othersParsed);
  const financed = Math.max(0, toCents(total - othersSum));
  const over = othersSum > total + 0.005;

  function update(key: string, patch: Partial<OtherLine>) {
    setOthers((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    setOthers((prev) => prev.filter((l) => l.key !== key));
  }
  function add() {
    // Financed line + others must stay within the max split count.
    setOthers((prev) => (prev.length >= MAX_PAYMENT_SPLITS - 1 ? prev : [...prev, newLine()]));
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <input type="hidden" name="isSplitPayment" value={on ? 'on' : ''} />
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
        <span><b>Split payment</b> — the customer is paying with more than one method (e.g. a down payment + financing)</span>
      </label>

      {on && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {/* Financed line — auto-fills as the remainder; read-only. */}
          <div className="flex items-center gap-2">
            <div className="input flex-[1.4] cursor-default bg-brand-50 text-sm font-medium text-brand-700">Financed (auto)</div>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
              <input
                readOnly
                value={financed.toFixed(2)}
                tabIndex={-1}
                className="input pl-5 text-right text-sm font-semibold tabular-nums text-brand-700"
                aria-label="Financed amount (auto-calculated)"
              />
            </div>
            <span className="w-6 flex-none" aria-hidden />
            {/* Submitted values for the financed line. */}
            <input type="hidden" name="splitMethod" value={FINANCED_SPLIT_METHOD} />
            <input type="hidden" name="splitAmount" value={financed.toFixed(2)} />
          </div>

          {/* Other (non-financed) lines — down payments, entered manually. */}
          {others.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <select
                name="splitMethod"
                value={l.method}
                onChange={(e) => update(l.key, { method: e.target.value as PaymentMethod })}
                className="input flex-[1.4] text-sm"
              >
                <option value="">Method…</option>
                {NON_FINANCED_SPLIT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input
                  name="splitAmount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={l.amount}
                  onChange={(e) => update(l.key, { amount: e.target.value.replace(/[^\d.]/g, '') })}
                  className="input pl-5 text-right text-sm tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(l.key)}
                className="w-6 flex-none text-gray-400 hover:text-gray-600"
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}

          {others.length < MAX_PAYMENT_SPLITS - 1 && (
            <button type="button" onClick={add} className="w-full rounded-md border border-dashed border-brand-300 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
              + Add a down payment / other method
            </button>
          )}

          <div className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${over ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            <span>Deal total {money(total)}</span>
            <span className="font-semibold">
              {over ? `Other payments exceed the total by ${money(othersSum - total)}` : `Financed ${money(financed)} + other ${money(othersSum)}`}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Enter the deal total above and any down payments here — the financed amount fills in automatically.
          </p>
        </div>
      )}
    </div>
  );
}
