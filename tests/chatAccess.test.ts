import { describe, it, expect } from 'vitest';
import { canAccessConversation } from '@/lib/chat';
import type { SessionUser } from '@/lib/session';

function user(partial: Partial<SessionUser>): SessionUser {
  return {
    userId: 'u1', email: 'x@y.z', name: 'Test',
    role: 'DEALER_USER', dealerId: null,
    isDistributor: false, superAdmin: false, adminSections: [],
    ...partial,
  };
}

describe('canAccessConversation — office isolation', () => {
  const convA = { dealerId: 'dealer_a' };
  const convB = { dealerId: 'dealer_b' };

  it('a dealer can only reach their own office\'s conversation', () => {
    const u = user({ role: 'DEALER_USER', dealerId: 'dealer_a' });
    expect(canAccessConversation(u, convA)).toBe(true);
    expect(canAccessConversation(u, convB)).toBe(false);
  });

  it('internal staff (not impersonating) can reach any office\'s conversation', () => {
    const admin = user({ role: 'ADMIN' });
    const reviewer = user({ role: 'REVIEWER' });
    expect(canAccessConversation(admin, convA)).toBe(true);
    expect(canAccessConversation(reviewer, convB)).toBe(true);
  });

  it('an admin "viewing as" a dealer is confined to that dealer\'s conversations', () => {
    const u = user({ role: 'ADMIN', dealerId: 'dealer_a', impersonating: true });
    expect(canAccessConversation(u, convA)).toBe(true);
    expect(canAccessConversation(u, convB)).toBe(false);
  });
});
