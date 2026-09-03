import { describe, it, expect } from 'vitest';
import {
  dealIsFinanced,
  hdReferenceRequired,
  missingRequiredReferences,
  referenceGateError,
  approvalGateError,
  hdOriginLabel,
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

// Approval gate — nothing reaches Approved/Conditional without a finance company
// + loan number. The HD Customer # is NOT required to approve (it can be added
// afterward); it's enforced later, at the funding/journal gate.
describe('approvalGateError', () => {
  it('requires the finance company and loan number for an empty HD deal (but not the HD #)', () => {
    expect(
      approvalGateError({ programType: 'HD', financeCompanyId: null, financeItNumber: null, hdReference: null }),
    ).toBe('Add a finance company and the loan / approval number before approving this deal.');
  });

  it('does not require an HD # for a GWA deal', () => {
    expect(
      approvalGateError({ programType: 'GWA', financeCompanyId: 'fc1', financeItNumber: 'L-1', hdReference: null }),
    ).toBeNull();
  });

  it('lets an HD deal approve without the HD # once it has finance company + loan number', () => {
    expect(
      approvalGateError({ programType: 'HD', financeCompanyId: 'fc1', financeItNumber: 'L-1', hdReference: null }),
    ).toBeNull();
  });

  it('still requires the loan number for a GWA deal', () => {
    expect(
      approvalGateError({ programType: 'GWA', financeCompanyId: 'fc1', financeItNumber: '  ', hdReference: null }),
    ).toBe('Add the loan / approval number before approving this deal.');
  });

  it('passes once an HD deal has finance company + loan number', () => {
    expect(
      approvalGateError({ programType: 'HD', financeCompanyId: 'fc1', financeItNumber: 'L-1', hdReference: '800123' }),
    ).toBeNull();
  });
});

// HD Customer # origin — 701 = store lead, 800 = GWA-created, else unknown.
describe('hdOriginLabel', () => {
  it('labels 701 numbers as a Home Depot lead', () => {
    expect(hdOriginLabel('701456')).toBe('Home Depot lead');
  });
  it('labels 800 numbers as GWA-created', () => {
    expect(hdOriginLabel('800999')).toBe('GWA-created');
  });
  it('returns null for other prefixes or empty input', () => {
    expect(hdOriginLabel('123')).toBeNull();
    expect(hdOriginLabel(null)).toBeNull();
    expect(hdOriginLabel('')).toBeNull();
  });
});
