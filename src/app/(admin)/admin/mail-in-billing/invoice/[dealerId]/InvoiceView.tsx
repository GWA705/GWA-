'use client';

import { useState } from 'react';
import { computeInvoice, money, type BillingRates } from '@/lib/billingMath';

interface Party {
  name: string;
  lines: string[];
}

export function InvoiceView({
  gwa,
  billTo,
  invoiceNo,
  invoiceDate,
  periodLabel,
  leads,
  rates,
}: {
  gwa: Party & { legal?: string; contact: string[] };
  billTo: Party;
  invoiceNo: string;
  invoiceDate: string;
  periodLabel: string;
  leads: number;
  rates: BillingRates;
}) {
  const [env, setEnv] = useState(leads);
  const a = computeInvoice(leads, Number.isFinite(env) ? env : 0, rates);

  return (
    <>
      {/* Print rule: when printing, show only #invoice, drop the portal chrome. */}
      <style>{`@media print {
        .no-print { display: none !important; }
        body * { visibility: hidden; }
        #invoice, #invoice * { visibility: visible; }
        #invoice { position: absolute; inset: 0; margin: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 8mm; }
      }`}</style>

      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm text-gray-700">
          <span className="mb-1 block font-medium">Envelopes (mailings) to bill</span>
          <input
            type="number"
            min={0}
            value={env}
            onChange={(e) => setEnv(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="ml-2 text-xs text-gray-400">defaults to one per lead ({leads})</span>
        </label>
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          🖨 Print / Save as PDF
        </button>
      </div>

      <div id="invoice" className="rounded-2xl border border-gray-200 bg-white p-8 text-gray-900 shadow-sm">
        {/* Header: from (GWA) + INVOICE meta */}
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-200 pb-5">
          <div>
            <div className="text-lg font-bold">{gwa.name}</div>
            {gwa.lines.map((l, i) => <div key={i} className="text-sm text-gray-600">{l}</div>)}
            <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
              {gwa.contact.map((l, i) => <div key={i}>{l}</div>)}
            </div>
            {gwa.legal ? <div className="mt-1 text-[11px] text-gray-400">{gwa.legal}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-tight text-gray-800">INVOICE</div>
            <div className="mt-2 text-sm text-gray-600">Invoice #: <span className="font-semibold text-gray-900">{invoiceNo}</span></div>
            <div className="text-sm text-gray-600">Date: <span className="font-medium text-gray-900">{invoiceDate}</span></div>
            <div className="text-sm text-gray-600">Period: <span className="font-medium text-gray-900">{periodLabel}</span></div>
          </div>
        </div>

        {/* Bill to */}
        <div className="py-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Bill to</div>
          <div className="mt-1 text-base font-semibold">{billTo.name}</div>
          {billTo.lines.length > 0
            ? billTo.lines.map((l, i) => <div key={i} className="text-sm text-gray-600">{l}</div>)
            : <div className="text-sm italic text-gray-400">No office address on file — add it in Admin → Dealers.</div>}
        </div>

        {/* Line items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-2 font-medium">Description</th>
              <th className="py-2 px-2 text-right font-medium">Qty</th>
              <th className="py-2 px-2 text-right font-medium">Rate</th>
              <th className="py-2 pl-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="py-2.5 pr-2">Mail-in leads uploaded on your behalf — {periodLabel}</td>
              <td className="py-2.5 px-2 text-right tabular-nums">{a.leads}</td>
              <td className="py-2.5 px-2 text-right tabular-nums">{money(a.leadRate)}</td>
              <td className="py-2.5 pl-2 text-right tabular-nums">{money(a.leadTotal)}</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-2">Mailing (envelopes)</td>
              <td className="py-2.5 px-2 text-right tabular-nums">{a.envelopes}</td>
              <td className="py-2.5 px-2 text-right tabular-nums">{money(a.envelopeRate)}</td>
              <td className="py-2.5 pl-2 text-right tabular-nums">{money(a.envelopeTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{money(a.subtotal)}</span></div>
            {a.hstPercent > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">HST ({a.hstPercent}%)</span><span className="tabular-nums">{money(a.hst)}</span></div>
            )}
            <div className="flex justify-between border-t border-gray-300 pt-1.5 text-base font-bold"><span>Total due</span><span className="tabular-nums">{money(a.total)}</span></div>
          </div>
        </div>

        <p className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-400">
          Thank you. Please remit payment to Georgian Water &amp; Air. Questions? info@georgianwaterandair.ca · 1.866.840.2789
        </p>
      </div>
    </>
  );
}
