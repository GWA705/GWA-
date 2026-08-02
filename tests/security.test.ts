import { describe, it, expect } from 'vitest';
import { mfaRequiredForRole } from '@/lib/settings';

describe('MFA requirement policy', () => {
  it("'everyone' requires 2FA for all roles", () => {
    for (const r of ['DEALER_USER', 'REVIEWER', 'ADMIN']) {
      expect(mfaRequiredForRole(r, 'everyone')).toBe(true);
    }
  });

  it("'staff' requires 2FA for reviewers/admins but not dealers", () => {
    expect(mfaRequiredForRole('DEALER_USER', 'staff')).toBe(false);
    expect(mfaRequiredForRole('REVIEWER', 'staff')).toBe(true);
    expect(mfaRequiredForRole('ADMIN', 'staff')).toBe(true);
  });

  it("'off' never requires 2FA", () => {
    for (const r of ['DEALER_USER', 'REVIEWER', 'ADMIN']) {
      expect(mfaRequiredForRole(r, 'off')).toBe(false);
    }
  });
});
