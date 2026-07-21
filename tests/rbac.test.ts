import { describe, it, expect } from 'vitest';
import {
  canAccessApplication,
  applicationScopeWhere,
  isInternal,
  isAdmin,
  isDealer,
} from '@/lib/rbac';
import type { SessionUser } from '@/lib/session';

const dealerA: SessionUser = { userId: 'u1', email: 'a@x', name: 'A', role: 'DEALER_USER', dealerId: 'dealer-A' };
const dealerB: SessionUser = { userId: 'u2', email: 'b@x', name: 'B', role: 'DEALER_USER', dealerId: 'dealer-B' };
const reviewer: SessionUser = { userId: 'u3', email: 'r@x', name: 'R', role: 'REVIEWER', dealerId: null };
const admin: SessionUser = { userId: 'u4', email: 'ad@x', name: 'Ad', role: 'ADMIN', dealerId: null };

describe('tenant isolation', () => {
  it('lets a dealer access only their own applications', () => {
    expect(canAccessApplication(dealerA, 'dealer-A')).toBe(true);
    expect(canAccessApplication(dealerA, 'dealer-B')).toBe(false);
  });

  it('blocks one dealer from another dealer', () => {
    expect(canAccessApplication(dealerB, 'dealer-A')).toBe(false);
    expect(canAccessApplication(dealerB, 'dealer-B')).toBe(true);
  });

  it('lets internal staff access any application', () => {
    expect(canAccessApplication(reviewer, 'dealer-A')).toBe(true);
    expect(canAccessApplication(reviewer, 'dealer-B')).toBe(true);
    expect(canAccessApplication(admin, 'dealer-A')).toBe(true);
  });

  it('scopes dealer queries to their dealerId, staff to all', () => {
    expect(applicationScopeWhere(dealerA)).toEqual({ dealerId: 'dealer-A' });
    expect(applicationScopeWhere(reviewer)).toEqual({});
  });

  it('never scopes to a real dealer when dealerId is missing', () => {
    const broken: SessionUser = { ...dealerA, dealerId: null };
    expect(applicationScopeWhere(broken)).toEqual({ dealerId: '__none__' });
    expect(canAccessApplication(broken, 'dealer-A')).toBe(false);
  });

  it('classifies roles correctly', () => {
    expect(isInternal(reviewer)).toBe(true);
    expect(isInternal(dealerA)).toBe(false);
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(reviewer)).toBe(false);
    expect(isDealer(dealerA)).toBe(true);
  });
});
