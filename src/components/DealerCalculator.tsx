'use client';

import { useState, useTransition } from 'react';
import { computeDealerPayout, PROVINCE_TAX_RATE } from '@/lib/payoutCalc';
import { searchDealerDeals, type DealMatch } from '@/app/(dealer)/dealer/calculator/actions';

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
  const [customer, setCustomer] = useState('');
  const [copied, setCopied] = useState(false);

  // Portal deal lookup.
  const [lookup, setLookup] = useState('');
  const [results, setResults] = useState<DealMatch[] | null>(null);
  const [searching, startSearch] = useTransition();

  function runSearch() {
    const q = lookup.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      setResults(await searchDealerDeals(q));
    });
  }

  function pickDeal(d: DealMatch) {
    if (d.amount != null) setAmount(String(d.amount));
    if (PROVINCES.includes(d.province)) setProvince(d.province);
    setCustomer(d.name);
    setReference(d.reference || d.name);
    setResults(null);
    setLookup('');
  }

  const n = Number(amount.replace(/[^0-9.]/g, ''));
  const r = n > 0 ? computeDealerPayout(n, province) : null;

  function copyBreakdown() {
    if (!r?.ok) return;
    const lines = [
      'GWA — Dealer Payout Breakdown',
      customer ? `Customer: ${customer}` : null,
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
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Portal deal lookup */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="label" htmlFor="calc-lookup">Find a portal deal <span className="font-normal text-gray-400">(customer name or deal #)</span></label>
        <div className="flex gap-2">
          <input
            id="calc-lookup"
            className="input flex-1"
            placeholder="Start typing a name or reference…"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
            autoComplete="off"
          />
          <button type="button" onClick={runSearch} className="btn-secondary" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">Pulls the approved amount + province straight from your portal deals.</p>

        {results && (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            {results.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500">No matching deals found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {results.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => pickDeal(d)}
                    disabled={d.amount == null}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title={d.amount == null ? 'No approved amount recorded on this deal yet' : 'Use this deal'}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{d.name || '(no name)'}</span>
                      <span className="block text-xs text-gray-400">
                        {[d.reference && `#${d.reference}`, d.province, d.statusLabel].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-gray-700">
                      {d.amount != null ? money(d.amount) : 'No amount yet'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inputs */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {customer && (
          <div className="mb-4 flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm">
            <span className="text-sky-800">Customer: <strong>{customer}</strong></span>
            <button type="button" onClick={() => setCustomer('')} className="text-xs text-gray-500 hover:underline">clear</button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label className="label" htmlFor="calc-amount">Approved amount <span className="font-normal text-gray-400">(total sale with tax)</span></label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-300">$</span>
              <input
                id="calc-amount"
                inputMode="decimal"
                className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pl-10 pr-3 text-2xl font-bold tabular-nums text-gray-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="calc-prov">Province</label>
            <select id="calc-prov" className="w-full rounded-xl border border-gray-300 bg-gray-50 py-3 px-3 text-lg font-semibold text-gray-900 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">Province sets the tax rate — change it for an out-of-province deal.</p>
        <div className="mt-4">
          <label className="label" htmlFor="calc-ref">Reference / deal # <span className="font-normal text-gray-400">(optional, for your records)</span></label>
          <input id="calc-ref" className="input" placeholder="e.g. customer name or deal number" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
        </div>
      </div>

      {/* Result */}
      {r?.ok && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          {/* Hero total */}
          <div className="relative px-6 py-7 text-center text-white" style={{ background: 'linear-gradient(135deg,#0f7a4d,#1aa06a)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Estimated EFT payout{customer ? ` · ${customer}` : ''}
            </div>
            <div className="mt-1 text-4xl font-extrabold tabular-nums sm:text-5xl">{money(r.payout)}</div>
            <div className="mt-1 text-sm text-white/70">
              {r.province} · tax {pct(r.taxRate)}{reference ? ` · ${reference}` : ''}
            </div>
            <button
              type="button"
              onClick={copyBreakdown}
              className="absolute right-4 top-4 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/25"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          {/* Breakdown */}
          <div className="bg-white">
            <div className="px-5 pt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">How it&apos;s calculated</div>
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
                <tr className="border-t-2 border-emerald-100 bg-emerald-50">
                  <td className="px-5 py-3 text-sm font-semibold text-emerald-800">TOTAL EFT PAYOUT</td>
                  <td className="px-5 py-3 text-right text-lg font-bold tabular-nums text-emerald-800">{money(r.payout)}</td>
                </tr>
              </tfoot>
            </table>
            {r.warning && <p className="border-t border-gray-100 px-5 py-2 text-xs text-amber-700">{r.warning}</p>}
          </div>
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
