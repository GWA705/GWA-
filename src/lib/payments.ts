import type { PaymentMethod, ProgramType } from '@prisma/client';
import { isFinancedMethod, dealIsFinanced } from '@/lib/constants';

/**
 * Split / multi-method payments. A deal total can be divided across up to three
 * lines (method + amount). The financed portion — what the finance company funds
 * and the loan/HD paperwork is written for — is the sum of the financing lines
 * (FinanceIt / a finance company). This module is the single source of truth for
 * that math, used by intake, the reviewer view, the journal, and gating.
 */

export const MAX_PAYMENT_SPLITS = 3;
// Money tolerance for float rounding when checking lines sum to the total.
const EPSILON = 0.005;

export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
}

/** Round to cents to avoid float drift. */
export function toCents(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** The financed portion of a set of split lines. */
export function financedFromSplits(lines: PaymentLine[]): number {
  return toCents(lines.filter((l) => isFinancedMethod(l.method)).reduce((s, l) => s + (Number(l.amount) || 0), 0));
}

/** Sum of all split lines. */
export function totalFromSplits(lines: PaymentLine[]): number {
  return toCents(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
}

export interface SplitValidation {
  ok: boolean;
  total: number;
  financed: number;
  remaining: number; // dealTotal − sum(lines); 0 when balanced
  error?: string;
}

/** Validate a set of split lines against the deal total. */
export function validateSplits(lines: PaymentLine[], dealTotal: number): SplitValidation {
  const cleaned = lines.filter((l) => l.method && Number(l.amount) > 0);
  const total = totalFromSplits(cleaned);
  const financed = financedFromSplits(cleaned);
  const remaining = toCents(dealTotal - total);

  if (cleaned.length < 2) {
    return { ok: false, total, financed, remaining, error: 'Add at least two payment methods, or turn split payment off.' };
  }
  if (cleaned.length > MAX_PAYMENT_SPLITS) {
    return { ok: false, total, financed, remaining, error: `A deal can have at most ${MAX_PAYMENT_SPLITS} payment methods.` };
  }
  if (Math.abs(remaining) > EPSILON) {
    return {
      ok: false,
      total,
      financed,
      remaining,
      error: remaining > 0 ? `$${remaining.toFixed(2)} of the total is still unallocated.` : `The payments exceed the deal total by $${Math.abs(remaining).toFixed(2)}.`,
    };
  }
  return { ok: true, total, financed, remaining: 0 };
}

/**
 * The financed amount for any deal — split or not — for display/journal/gating.
 * Split deals carry a stored financedAmount (sum of financing lines); non-split
 * deals derive it: the full amount when financed, 0 when fully paid another way.
 * Amounts are numbers (convert Prisma Decimals with Number() before calling).
 */
export function displayFinancedAmount(deal: {
  isSplitPayment: boolean;
  financedAmount?: number | null;
  requestedAmount: number;
  approvedAmount?: number | null;
  paymentMethod: PaymentMethod | null;
}): number {
  if (deal.isSplitPayment && deal.financedAmount != null) return toCents(deal.financedAmount);
  return dealIsFinanced(deal.paymentMethod) ? toCents(deal.approvedAmount ?? deal.requestedAmount) : 0;
}

// Decimal-tolerant wrappers for use straight off a Prisma Application record.
type Decimalish = { toString(): string } | number | null | undefined;
const numOf = (v: Decimalish): number | null => (v == null ? null : Number(v));

export function financedAmountOf(app: {
  isSplitPayment: boolean;
  financedAmount: Decimalish;
  requestedAmount: Decimalish;
  approvedAmount: Decimalish;
  paymentMethod: PaymentMethod | null;
}): number {
  return displayFinancedAmount({
    isSplitPayment: app.isSplitPayment,
    financedAmount: numOf(app.financedAmount),
    requestedAmount: numOf(app.requestedAmount) ?? 0,
    approvedAmount: numOf(app.approvedAmount),
    paymentMethod: app.paymentMethod,
  });
}

/**
 * The NON-financed portion of a deal — what was paid by cash / cheque / credit
 * card rather than financed. This is the "Cash/Chq /CC Amount" the journal wants
 * in column J: for a split deal it's total − financed (e.g. a $10,000 deal with
 * $500 on a card and $9,500 financed → $500); for a fully-paid (non-financed)
 * deal it's the whole amount; for a fully-financed deal it's 0.
 *
 * The deal total for a split is its requestedAmount (the splits validate to that
 * at intake); for a non-split deal it's the approved amount, or requested when
 * not yet approved.
 */
export function nonFinancedAmountOf(app: {
  isSplitPayment: boolean;
  financedAmount: Decimalish;
  requestedAmount: Decimalish;
  approvedAmount: Decimalish;
  paymentMethod: PaymentMethod | null;
}): number {
  const total = app.isSplitPayment
    ? numOf(app.requestedAmount) ?? 0
    : numOf(app.approvedAmount) ?? numOf(app.requestedAmount) ?? 0;
  const nonFinanced = toCents(total - financedAmountOf(app));
  return nonFinanced > 0 ? nonFinanced : 0;
}

/**
 * The journal's "How They Payed" code (column F) for a deal: the program prefix
 * (HD, or GHS for a GWA deal) joined to the funding source —
 *   FinanceIt → …FINIT, Enercare → …Ener, UEI → …UEI
 * so an HD FinanceIt deal is "HDFINIT" and the GWA one "GHSFINIT". Non-financed
 * card deals are fixed codes: a plain credit card is "CCHD" and a Home-Depot
 * credit card "HDCC". Cash / cheque / e-transfer have no code (returns null, so
 * the writer leaves the cell for the office to fill). For a split finance+card
 * deal the financed side wins the code (the card amount lands in column J).
 */
export function journalPayCode(deal: {
  programType: ProgramType;
  paymentMethod: PaymentMethod | null;
  financeCompanyName: string | null;
  splitMethods?: PaymentMethod[];
  hasFinancedPortion: boolean;
}): string | null {
  const prefix = deal.programType === 'GWA' ? 'GHS' : 'HD';

  if (deal.hasFinancedPortion) {
    const isFinanceIt =
      deal.paymentMethod === 'FINANCEIT' || (deal.splitMethods ?? []).includes('FINANCEIT');
    const suffix = isFinanceIt ? 'FINIT' : financeCodeSuffix(deal.financeCompanyName);
    return suffix ? `${prefix}${suffix}` : null;
  }

  if (deal.paymentMethod === 'HD_CREDIT_CARD') return 'HDCC';
  if (deal.paymentMethod === 'CREDIT_CARD') return 'CCHD';
  return null;
}

/** Map a finance company's free-text name to its journal code suffix. */
function financeCodeSuffix(name: string | null | undefined): string | null {
  const u = String(name ?? '').toUpperCase();
  if (!u) return null;
  if (u.includes('ENERCARE') || u.includes('ENER')) return 'Ener';
  if (u.includes('UEI')) return 'UEI';
  if (u.includes('FINANCEIT') || u.includes('FINANCE IT') || u.includes('FINIT')) return 'FINIT';
  return null;
}

/** Does this deal have a financed portion (so a financing number is required)? */
export function dealHasFinancing(app: {
  isSplitPayment: boolean;
  financedAmount: Decimalish;
  requestedAmount: Decimalish;
  approvedAmount: Decimalish;
  paymentMethod: PaymentMethod | null;
}): boolean {
  return financedAmountOf(app) > 0;
}
