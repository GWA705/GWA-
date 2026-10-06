import { describe, it, expect } from 'vitest';
import { diagnoseFundingSubmit, type FundingSubmitInput } from '../src/lib/fundingSubmitStatus';

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
