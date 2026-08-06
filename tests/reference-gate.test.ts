import { describe, it, expect } from 'vitest';
import {
  dealIsFinanced,
  hdReferenceRequired,
  missingRequiredReferences,
  referenceGateError,
} from '@/lib/constants';

// A deal is financed unless it was paid by an explicit non-finance method.
describe('dealIsFinanced', () => {
  it('treats FinanceIT and a null payment method (regular finance app) as financed', () => {
    expect(dealIsFinanced('FINANCEIT')).toBe(true);
    expect(dealIsFinanced(null)).toBe(true);
  });
  it('treats cash / cheque / credit card / HD credit card as not financed', () => {
    expect(dealIsFinanced('CASH')).toBe(false);
    expect(dealIsFinanced('CHEQUE')).toBe(false);
    expect(dealIsFinanced('CREDIT_CARD')).toBe(false);
    expect(dealIsFinanced('HD_CREDIT_CARD')).toBe(false);
  });
});

// The HD Customer # only applies to HD-program deals.
describe('hdReferenceRequired', () => {
  it('requires the HD Customer # for HD deals only', () => {
    expect(hdReferenceRequired('HD')).toBe(true);
    expect(hdReferenceRequired('GWA')).toBe(false);
  });
});

describe('missingRequiredReferences', () => {
  it('HD + financed needs both numbers', () => {
    expect(
      missingRequiredReferences({ programType: 'HD', financed: true, hdReference: null, financeItNumber: null }),
    ).toEqual(['the HD Customer #', 'the Financing deal number']);
  });

  it('HD + cash needs only the HD Customer # (no loan number)', () => {
    expect(
      missingRequiredReferences({ programType: 'HD', financed: false, hdReference: null, financeItNumber: null }),
    ).toEqual(['the HD Customer #']);
  });

  it('GWA + financed needs only the Financing deal number (no HD #)', () => {
    expect(
      missingRequiredReferences({ programType: 'GWA', financed: true, hdReference: null, financeItNumber: null }),
    ).toEqual(['the Financing deal number']);
  });

  it('GWA + cash needs neither number', () => {
    expect(
      missingRequiredReferences({ programType: 'GWA', financed: false, hdReference: null, financeItNumber: null }),
    ).toEqual([]);
  });

  it('nothing missing once the required numbers are present', () => {
    expect(
      missingRequiredReferences({ programType: 'HD', financed: true, hdReference: 'HD-1', financeItNumber: 'FIT-1' }),
    ).toEqual([]);
  });
});

describe('referenceGateError', () => {
  it('returns null when nothing is required (GWA cash deal)', () => {
    expect(
      referenceGateError(
        { programType: 'GWA', financed: false, hdReference: null, financeItNumber: null },
        'funding this deal',
      ),
    ).toBeNull();
  });

  it('joins two missing numbers with "and"', () => {
    expect(
      referenceGateError(
        { programType: 'HD', financed: true, hdReference: null, financeItNumber: null },
        'funding this deal',
      ),
    ).toBe('Add the HD Customer # and the Financing deal number before funding this deal.');
  });

  it('names the single missing number', () => {
    expect(
      referenceGateError(
        { programType: 'GWA', financed: true, hdReference: null, financeItNumber: null },
        'writing to the journal',
      ),
    ).toBe('Add the Financing deal number before writing to the journal.');
  });
});
