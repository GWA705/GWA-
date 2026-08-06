'use client';

import { useState } from 'react';
import { SPLIT_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { MAX_PAYMENT_SPLITS, financedFromSplits, totalFromSplits, toCents } from '@/lib/payments';
import type { PaymentMethod } from '@prisma/client';

interface Line {
  key: string;
  method: PaymentMethod | '';
  amount: string;
}

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let seq = 0;
const newLine = (method: PaymentMethod | '' = '', amount = ''): Line => ({ key: `l${seq++}`, method, amount });

/**
 * Split / multi-method payment entry. A toggle reveals up to three payment lines
 * (method + amount); a live readout shows how much is still unallocated against
 * the deal total and how much of it is financed. Posts `isSplitPayment` plus
 * repeated `splitMethod` / `splitAmount` fields the server reads with getAll().
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
  const [on, setOn] = useState(defaultOn);
  const [lines, setLines] = useState<Line[]>(
    defaultSplits.length >= 2
      ? defaultSplits.map((s) => newLine(s.method, String(s.amount)))
      : [newLine('FINANCEIT'), newLine('CASH')],
  );

  const parsed = lines
    .filter((l) => l.method && Number(l.amount) > 0)
    .map((l) => ({ method: l.method as PaymentMethod, amount: Number(l.amount) }));
  const allocated = totalFromSplits(parsed);
  const financed = financedFromSplits(parsed);
  const remaining = toCents(total - allocated);
  const balanced = total > 0 && Math.abs(remaining) < 0.005 && parsed.length >= 2;

  function update(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.key !== key)));
  }
  function add() {
    setLines((prev) => (prev.length >= MAX_PAYMENT_SPLITS ? prev : [...prev, newLine()]));
  }
  // Fill the last empty amount with whatever's left, for speed.
  function fillRemaining(key: string) {
    if (remaining > 0) update(key, { amount: remaining.toFixed(2) });
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
          {lines.map((l, i) => {
            const fin = l.method && SPLIT_PAYMENT_METHODS.find((m) => m.value === l.method)?.financed;
            return (
              <div key={l.key} className="flex items-center gap-2">
                <select
                  name="splitMethod"
                  value={l.method}
                  onChange={(e) => update(l.key, { method: e.target.value as PaymentMethod })}
                  className={`input flex-[1.4] text-sm ${fin ? 'font-medium text-brand-700' : ''}`}
                >
                  <option value="">Method…</option>
                  {SPLIT_PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}{m.financed ? ' (financed)' : ''}</option>
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
                    onFocus={() => !l.amount && fillRemaining(l.key)}
                    className="input pl-5 text-right text-sm tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(l.key)}
                  disabled={lines.length <= 2}
                  className="w-6 flex-none text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  aria-label="Remove line"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {lines.length < MAX_PAYMENT_SPLITS && (
            <button type="button" onClick={add} className="w-full rounded-md border border-dashed border-brand-300 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">
              + Add payment method
            </button>
          )}

          <div className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${balanced ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            <span>Allocated {money(allocated)} of {money(total)}</span>
            <span className="font-semibold">{balanced ? 'Balanced ✓' : remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over`}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm">
            <span className="font-semibold text-brand-700">Amount financed</span>
            <span className="font-bold tabular-nums text-brand-700">{money(financed)}</span>
          </div>
          <p className="text-xs text-gray-400">
            The {PAYMENT_METHOD_LABELS.FINANCEIT} / {PAYMENT_METHOD_LABELS.FINANCE_COMPANY} portion is what gets a loan number; cash &amp; card portions don&apos;t.
          </p>
        </div>
      )}
    </div>
  );
}
