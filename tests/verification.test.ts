import { describe, it, expect } from 'vitest';
import { applicableVerificationChecks, VERIFICATION_CHECKS } from '../src/lib/constants';

describe('applicableVerificationChecks', () => {
  it('excludes the serial-match item when serials are not required', () => {
    const keys = applicableVerificationChecks(false).map((c) => c.key);
    expect(keys).toContain('PRODUCTS_PHOTO');
    expect(keys).toContain('SIGNATURES');
    expect(keys).toContain('PAP_VOID');
    expect(keys).not.toContain('SERIALS_MATCH');
  });

  it('includes the serial-match item when serials are required (e.g. UEI)', () => {
    const keys = applicableVerificationChecks(true).map((c) => c.key);
    expect(keys).toContain('SERIALS_MATCH');
    expect(keys).toHaveLength(VERIFICATION_CHECKS.length);
  });
});
