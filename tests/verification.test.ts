import { describe, it, expect } from 'vitest';
import { applicableVerificationChecks, VERIFICATION_CHECKS } from '../src/lib/constants';

describe('applicableVerificationChecks', () => {
  it('returns the full funding verification checklist', () => {
    const keys = applicableVerificationChecks(false).map((c) => c.key);
    expect(keys).toContain('PRODUCTS_PHOTO');
    expect(keys).toContain('SIGNATURES');
    expect(keys).toContain('PAP_VOID');
    expect(keys).toHaveLength(VERIFICATION_CHECKS.length);
  });

  it('the photo item covers serial numbers where required', () => {
    const photo = VERIFICATION_CHECKS.find((c) => c.key === 'PRODUCTS_PHOTO');
    expect(photo?.label.toLowerCase()).toContain('serial');
  });
});
