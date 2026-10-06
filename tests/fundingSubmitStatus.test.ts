import { describe, it, expect } from 'vitest';
import { diagnoseFundingSubmit, fundingPackageReadyToSubmit, type FundingSubmitInput } from '../src/lib/fundingSubmitStatus';

describe('fundingPackageReadyToSubmit', () => {
  const ready = { status: 'DOCS_SENT' as const, serialsComplete: true, requiredDocsMissing: false, fundingDocCount: 2 };

  it('is true when docs are in, serials done, and at least one doc uploaded', () => {
    expect(fundingPackageReadyToSubmit(ready)).toBe(true);
  });
  it('is false while a required document is still missing', () => {
    expect(fundingPackageReadyToSubmit({ ...ready, requiredDocsMissing: true })).toBe(false);
  });
  it('is false while a serial is still missing', () => {
    expect(fundingPackageReadyToSubmit({ ...ready, serialsComplete: false })).toBe(false);
  });
  it('is false when nothing has been uploaded yet (nothing to submit)', () => {
    expect(fundingPackageReadyToSubmit({ ...ready, fundingDocCount: 0 })).toBe(false);
  });
  it('only fires from DOCS_SENT (never re-submits a deal already moved on)', () => {
    expect(fundingPackageReadyToSubmit({ ...ready, status: 'FUNDING_SUBMITTED' })).toBe(false);
    expect(fundingPackageReadyToSubmit({ ...ready, status: 'APPROVED' })).toBe(false);
    expect(fundingPackageReadyToSubmit({ ...ready, status: 'FUNDED' })).toBe(false);
  });
});

const base: FundingSubmitInput = {
  status: 'DOCS_SENT',
  requiresSerialPerProduct: true,
  productsSold: ['Water Softener', 'Reverse Osmosis'],
  serialProductLabels: [],
  hasReturnedDocs: false,
};

describe('diagnoseFundingSubmit', () => {
  it('flags the missing serials that silently block the dealer submit', () => {
    const d = diagnoseFundingSubmit({ ...base, serialProductLabels: ['Water Softener'] });
    expect(d.show).toBe(true);
    expect(d.missingSerialProducts).toEqual(['Reverse Osmosis']);
    expect(d.title).toMatch(/can’t submit/i);
    expect(d.detail).toContain('Reverse Osmosis');
  });

  it('explains "uploaded but not submitted" when serials are fine and docs are back', () => {
    const d = diagnoseFundingSubmit({
      ...base,
      serialProductLabels: ['Water Softener', 'Reverse Osmosis'],
      hasReturnedDocs: true,
    });
    expect(d.show).toBe(true);
    expect(d.missingSerialProducts).toEqual([]);
    expect(d.title).toMatch(/never submitted/i);
  });

  it('says nothing when serials are complete and nothing has come back yet (normal wait)', () => {
    const d = diagnoseFundingSubmit({
      ...base,
      serialProductLabels: ['Water Softener', 'Reverse Osmosis'],
      hasReturnedDocs: false,
    });
    expect(d.show).toBe(false);
  });

  it('ignores the serial rule when the finance company does not require it', () => {
    const d = diagnoseFundingSubmit({ ...base, requiresSerialPerProduct: false, hasReturnedDocs: true });
    expect(d.missingSerialProducts).toEqual([]);
    expect(d.title).toMatch(/never submitted/i); // falls through to the submit-not-pressed case
  });

  it('is silent once the deal has moved past DOCS_SENT', () => {
    expect(diagnoseFundingSubmit({ ...base, status: 'FUNDING_SUBMITTED' }).show).toBe(false);
    expect(diagnoseFundingSubmit({ ...base, status: 'FUNDING_REVIEW', hasReturnedDocs: true }).show).toBe(false);
    expect(diagnoseFundingSubmit({ ...base, status: 'FUNDED' }).show).toBe(false);
  });

  it('matches serials by trimmed product label', () => {
    const d = diagnoseFundingSubmit({
      ...base,
      productsSold: ['Water Softener'],
      serialProductLabels: ['  Water Softener  '],
    });
    expect(d.show).toBe(false); // the trimmed label satisfies the requirement
  });
});
