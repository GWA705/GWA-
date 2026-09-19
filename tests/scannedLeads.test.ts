import { describe, it, expect } from 'vitest';
import { canAccessScannedLead } from '@/lib/scannedLeads';
import type { SessionUser } from '@/lib/session';

// Minimal SessionUser builder — only the fields the access check reads matter.
function user(partial: Partial<SessionUser>): SessionUser {
  return {
    userId: 'u1',
    email: 'x@y.z',
    name: 'Test',
    role: 'DEALER_USER',
    dealerId: null,
    isDistributor: false,
    superAdmin: false,
    adminSections: [],
    ...partial,
  };
}

const calgary = { dealerId: 'dealer_calgary' };
const sudbury = { dealerId: 'dealer_sudbury' };
const unassigned = { dealerId: null };

describe('canAccessScannedLead — office isolation', () => {
  it('a dealer sees only their own office\'s cards', () => {
    const u = user({ role: 'DEALER_USER', dealerId: 'dealer_calgary' });
    expect(canAccessScannedLead(u, calgary)).toBe(true);
    expect(canAccessScannedLead(u, sudbury)).toBe(false);
    expect(canAccessScannedLead(u, unassigned)).toBe(false);
  });

  it('a dealer with no office sees nothing', () => {
    const u = user({ role: 'DEALER_USER', dealerId: null });
    expect(canAccessScannedLead(u, calgary)).toBe(false);
    expect(canAccessScannedLead(u, unassigned)).toBe(false);
  });

  it('internal staff (not impersonating) see every office\'s cards', () => {
    const admin = user({ role: 'ADMIN' });
    const reviewer = user({ role: 'REVIEWER' });
    for (const lead of [calgary, sudbury, unassigned]) {
      expect(canAccessScannedLead(admin, lead)).toBe(true);
      expect(canAccessScannedLead(reviewer, lead)).toBe(true);
    }
  });

  it('an admin "viewing as" a dealer sees ONLY that dealer\'s cards', () => {
    // Impersonation keeps role ADMIN but swaps in the dealer's id + sets the flag.
    const u = user({ role: 'ADMIN', dealerId: 'dealer_calgary', impersonating: true });
    expect(canAccessScannedLead(u, calgary)).toBe(true);
    expect(canAccessScannedLead(u, sudbury)).toBe(false);
    expect(canAccessScannedLead(u, unassigned)).toBe(false);
  });
});
