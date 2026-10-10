/**
 * Pure invoice money math — no imports, so both the server and the client invoice
 * component (with its live-editable envelope count) can use it.
 */

export interface BillingRates {
  leadRate: number;
  envelopeRate: number;
  hstPercent: number;
}

export interface InvoiceAmounts {
  leads: number;
  envelopes: number;
  leadRate: number;
  envelopeRate: number;
  leadTotal: number;
  envelopeTotal: number;
  subtotal: number;
  hstPercent: number;
  hst: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeInvoice(leads: number, envelopes: number, cfg: BillingRates): InvoiceAmounts {
  const leadTotal = round2(leads * cfg.leadRate);
  const envelopeTotal = round2(envelopes * cfg.envelopeRate);
  const subtotal = round2(leadTotal + envelopeTotal);
  const hst = round2(subtotal * (cfg.hstPercent / 100));
  const total = round2(subtotal + hst);
  return {
    leads, envelopes,
    leadRate: cfg.leadRate, envelopeRate: cfg.envelopeRate,
    leadTotal, envelopeTotal, subtotal, hstPercent: cfg.hstPercent, hst, total,
  };
}

export const money = (n: number): string =>
  `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
