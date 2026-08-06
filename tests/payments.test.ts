import { describe, it, expect } from 'vitest';
import {
  financedFromSplits,
  totalFromSplits,
  validateSplits,
  displayFinancedAmount,
  financedAmountOf,
  dealHasFinancing,
} from '@/lib/payments';

describe('split math', () => {
  const lines = [
    { method: 'FINANCEIT' as const, amount: 9500 },
    { method: 'CREDIT_CARD' as const, amount: 500 },
  ];

  it('sums the total and the financed portion', () => {
    expect(totalFromSplits(lines)).toBe(10000);
    expect(financedFromSplits(lines)).toBe(9500); // only the FinanceIT line is financed
  });

  it('treats a finance-company line as financed', () => {
    expect(financedFromSplits([{ method: 'FINANCE_COMPANY', amount: 8000 }, { method: 'CASH', amount: 2000 }])).toBe(8000);
  });

  it('an all-cash/card split has $0 financed', () => {
    expect(financedFromSplits([{ method: 'CASH', amount: 300 }, { method: 'HD_CREDIT_CARD', amount: 700 }])).toBe(0);
  });
});

describe('validateSplits', () => {
  it('passes when the lines add up to the total', () => {
    const v = validateSplits([{ method: 'FINANCEIT', amount: 9500 }, { method: 'CREDIT_CARD', amount: 500 }], 10000);
    expect(v.ok).toBe(true);
    expect(v.financed).toBe(9500);
    expect(v.remaining).toBe(0);
  });

  it('fails when under-allocated', () => {
    const v = validateSplits([{ method: 'FINANCEIT', amount: 9000 }, { method: 'CASH', amount: 500 }], 10000);
    expect(v.ok).toBe(false);
    expect(v.remaining).toBe(500);
  });

  it('fails when over-allocated', () => {
    const v = validateSplits([{ method: 'FINANCEIT', amount: 9000 }, { method: 'CASH', amount: 2000 }], 10000);
    expect(v.ok).toBe(false);
  });

  it('needs at least two methods', () => {
    expect(validateSplits([{ method: 'FINANCEIT', amount: 10000 }], 10000).ok).toBe(false);
  });

  it('rejects more than three methods', () => {
    const v = validateSplits(
      [
        { method: 'FINANCEIT', amount: 2500 },
        { method: 'CASH', amount: 2500 },
        { method: 'CHEQUE', amount: 2500 },
        { method: 'CREDIT_CARD', amount: 2500 },
      ],
      10000,
    );
    expect(v.ok).toBe(false);
  });
});

describe('displayFinancedAmount / non-split fallback', () => {
  it('split deal uses its stored financed amount', () => {
    expect(displayFinancedAmount({ isSplitPayment: true, financedAmount: 9500, requestedAmount: 10000, approvedAmount: null, paymentMethod: null })).toBe(9500);
  });

  it('non-split financed deal = full amount (approved wins over requested)', () => {
    expect(displayFinancedAmount({ isSplitPayment: false, requestedAmount: 10000, approvedAmount: 9800, paymentMethod: null })).toBe(9800);
    expect(displayFinancedAmount({ isSplitPayment: false, requestedAmount: 10000, approvedAmount: null, paymentMethod: 'FINANCEIT' })).toBe(10000);
  });

  it('non-split cash deal = $0 financed', () => {
    expect(displayFinancedAmount({ isSplitPayment: false, requestedAmount: 10000, approvedAmount: null, paymentMethod: 'CASH' })).toBe(0);
  });
});

describe('dealHasFinancing (Decimal-tolerant)', () => {
  it('true for a financed portion, false for none', () => {
    expect(dealHasFinancing({ isSplitPayment: true, financedAmount: 9500, requestedAmount: 10000, approvedAmount: null, paymentMethod: null })).toBe(true);
    expect(dealHasFinancing({ isSplitPayment: true, financedAmount: 0, requestedAmount: 10000, approvedAmount: null, paymentMethod: null })).toBe(false);
    expect(financedAmountOf({ isSplitPayment: false, financedAmount: null, requestedAmount: 5000, approvedAmount: null, paymentMethod: 'CASH' })).toBe(0);
  });
});
