'use client';

import { useState } from 'react';
import { computeDealerPayout, PROVINCE_TAX_RATE } from '@/lib/payoutCalc';

const PROVINCES = Object.keys(PROVINCE_TAX_RATE);
const money = (x: number) => `$${x.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (r: number) => `${(r * 100).toLocaleString('en-CA', { maximumFractionDigits: 3 })}%`;

/**
 * Dealer payout calculator with a full, accounting-grade breakdown. Enter the
 * approved amount (total sale with tax) + province and see every line the way
 * the HD calculator builds it, including the tax — so a dealer's accounting team
 * can enter it into their own system. Includes a copy-to-clipboard export.
 */
export function DealerCalculator({ defaultProvince = 'ON' }: { defaultProvince?: string }) {
  const [amount, setAmount] = useState('');
  const [province, setProvince] = useState(PROVINCES.includes(defaultProvince) ? defaultProvince : 'ON');
  const [reference, setReference] = useState('');
  const [copied, setCopied] = useState(false);

  const n = Number(amount.replace(/[^0-9.]/g, ''));
  const r = n > 0 ? computeDealerPayout(n, province) : null;

  function copyBreakdown() {
    if (!r?.ok) return;
    const lines = [
      'GWA — Dealer Payout Breakdown',
      reference ? `Reference: ${reference}` : null,
      `Province: ${r.province} (tax ${pct(r.taxRate)})`,
      '',
      `Total sale (with tax):        ${money(r.totalWithTax)}`,
      `Subtotal (pre-tax):           ${money(r.subtotal)}`,
      `HD Discount (13%):           -${money(r.hdDiscount)}`,
      `Subtotal after HD Discount:   ${money(r.afterHd)}`,
      `HD IBX Discount (1.25%):     -${money(r.ibxDiscount)}`,
      `Subtotal after IBX Discount:  ${money(r.afterIbx)}`,
      `HD Program (4%):             -${money(r.hdProgram)}`,
      `Net payout (pre-tax):         ${money(r.netPreTax)}`,
      `HST/Tax (${pct(r.taxRate)}):              +${money(r.hst)}`,
      `TOTAL EFT PAYOUT:             ${money(r.payout)}`,
    ].filter(Boolean);
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Inputs */}
      <div className="card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem]">
          <div>
            <label className="label" htmlFor="calc-amount">Approved amount (total sale with tax)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input id="calc-amount" inputMode="decimal" className="input pl-7 text-lg tabular-nums" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="calc-prov">Province</label>
            <select id="calc-prov" className="input text-lg" value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">Province sets the tax rate — change it for an out-of-province deal.</p>
        <div className="mt-3">
          <label className="label" htmlFor="calc-ref">Reference / deal # <span className="font-normal text-gray-400">(optional, for your records)</span></label>
          <input id="calc-ref" className="input" placeholder="e.g. customer name or deal number" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
        </div>
      </div>

      {/* Breakdown */}
      {r?.ok && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Payout breakdown</h2>
              <p className="text-xs text-gray-500">{r.province} · tax {pct(r.taxRate)}{reference ? ` · ${reference}` : ''}</p>
            </div>
            <button type="button" onClick={copyBreakdown} className="btn-secondary text-xs">
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          <table className="w-full text-sm">
            <tbody className="tabular-nums">
              <Line label="Total sale (with tax)" value={money(r.totalWithTax)} />
              <Line label="Subtotal (pre-tax)" value={money(r.subtotal)} muted />
              <Line label="HD Discount (13%)" value={`−${money(r.hdDiscount)}`} minus />
              <Line label="Subtotal after HD Discount" value={money(r.afterHd)} muted />
              <Line label="HD IBX Discount (1.25%)" value={`−${money(r.ibxDiscount)}`} minus />
              <Line label="Subtotal after IBX Discount" value={money(r.afterIbx)} muted />
              <Line label="HD Program (4%)" value={`−${money(r.hdProgram)}`} minus />
              <Line label="Net payout (pre-tax)" value={money(r.netPreTax)} strong />
              <Line label={`HST / Tax (${pct(r.taxRate)})`} value={`+${money(r.hst)}`} plus />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-brand-200 bg-brand-50">
                <td className="px-5 py-3 text-sm font-semibold text-brand-800">TOTAL EFT PAYOUT</td>
                <td className="px-5 py-3 text-right text-xl font-bold tabular-nums text-brand-800">{money(r.payout)}</td>
              </tr>
            </tfoot>
          </table>

          {r.warning && <p className="border-t border-gray-100 px-5 py-2 text-xs text-amber-700">{r.warning}</p>}
        </div>
      )}

      <p className="text-center text-xs text-gray-400">
        Estimate for your records. The amount paid is confirmed by GWA when the deal funds.
      </p>
    </div>
  );
}

function Line({ label, value, muted, strong, minus, plus }: { label: string; value: string; muted?: boolean; strong?: boolean; minus?: boolean; plus?: boolean }) {
  return (
    <tr className="border-b border-gray-100">
      <td className={`px-5 py-2.5 ${strong ? 'font-semibold text-gray-900' : muted ? 'text-gray-500' : 'text-gray-700'}`}>{label}</td>
      <td className={`px-5 py-2.5 text-right ${minus ? 'text-red-600' : plus ? 'text-emerald-700' : strong ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</td>
    </tr>
  );
}
