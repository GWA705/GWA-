'use client';

import { useState } from 'react';
import { computeDealerPayout, PROVINCE_TAX_RATE } from '@/lib/payoutCalc';

const PROVINCES = Object.keys(PROVINCE_TAX_RATE);

/**
 * Dealer-facing payout calculator. Enter the approved amount (total sale with
 * tax) and province → see the dealer payout. Result-focused: the internal
 * discount breakdown is intentionally NOT shown to dealers.
 */
export function DealerCalculator() {
  const [amount, setAmount] = useState('');
  const [province, setProvince] = useState('ON');
  const n = Number(amount.replace(/[^0-9.]/g, ''));
  const r = n > 0 ? computeDealerPayout(n, province) : null;
  const fmt = (x: number) => `$${x.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="calc-amount">Approved amount (total with tax)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                id="calc-amount"
                inputMode="decimal"
                className="input pl-7 text-lg"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="calc-prov">Province</label>
            <select id="calc-prov" className="input text-lg" value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-brand-50 p-5 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Estimated dealer payout</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-brand-800">
            {r?.ok ? fmt(r.payout) : '—'}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-gray-400">
        Estimate only. The amount paid is confirmed by GWA when the deal funds.
      </p>
    </div>
  );
}
