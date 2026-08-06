import type { PaymentMethod } from '@prisma/client';
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
