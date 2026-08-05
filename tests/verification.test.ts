import { describe, it, expect } from 'vitest';
import { applicableVerificationChecks, VERIFICATION_CHECKS } from '../src/lib/constants';

describe('applicableVerificationChecks', () => {
  it('returns the base funding verification checklist (no tax item unless flagged)', () => {
    const keys = applicableVerificationChecks(false).map((c) => c.key);
    expect(keys).toContain('PRODUCTS_PHOTO');
    expect(keys).toContain('SIGNATURES');
    expect(keys).toContain('PAP_VOID');
    expect(keys).not.toContain('TAX_EXEMPTION');
    // Equals the full list minus the conditional (serialsOnly / taxOnly) items.
    const alwaysOn = VERIFICATION_CHECKS.filter((c) => !c.serialsOnly && !c.taxOnly);
    expect(keys).toHaveLength(alwaysOn.length);
  });

  it('adds the tax-exemption item only for a tax-exempt deal', () => {
    expect(applicableVerificationChecks(false, false).map((c) => c.key)).not.toContain('TAX_EXEMPTION');
    expect(applicableVerificationChecks(false, true).map((c) => c.key)).toContain('TAX_EXEMPTION');
  });

  it('the photo item covers serial numbers where required', () => {
    const photo = VERIFICATION_CHECKS.find((c) => c.key === 'PRODUCTS_PHOTO');
    expect(photo?.label.toLowerCase()).toContain('serial');
  });
});
