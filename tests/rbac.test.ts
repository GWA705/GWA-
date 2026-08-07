import { describe, it, expect } from 'vitest';
import {
  canAccessApplication,
  applicationScopeWhere,
  isInternal,
  isAdmin,
  isDealer,
  isSuperAdmin,
  canAdminSection,
  hasAnyAdminSection,
} from '@/lib/rbac';
import type { SessionUser } from '@/lib/session';

// Base back-end permission fields default to "no admin access" for every fixture;
// individual tests override superAdmin/adminSections where they matter.
const noAdmin = { superAdmin: false, adminSections: [] as string[] };
const dealerA: SessionUser = { userId: 'u1', email: 'a@x', name: 'A', role: 'DEALER_USER', dealerId: 'dealer-A', ...noAdmin };
const dealerB: SessionUser = { userId: 'u2', email: 'b@x', name: 'B', role: 'DEALER_USER', dealerId: 'dealer-B', ...noAdmin };
const reviewer: SessionUser = { userId: 'u3', email: 'r@x', name: 'R', role: 'REVIEWER', dealerId: null, ...noAdmin };
const admin: SessionUser = { userId: 'u4', email: 'ad@x', name: 'Ad', role: 'ADMIN', dealerId: null, superAdmin: true, adminSections: [] };

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

describe('back-end admin permissions', () => {
  const superAdmin: SessionUser = { ...admin, superAdmin: true, adminSections: [] };
  const scopedMail: SessionUser = { ...admin, superAdmin: false, adminSections: ['mail', 'marketplace'] };
  const scopedNone: SessionUser = { ...admin, superAdmin: false, adminSections: [] };

  it('only an admin with superAdmin is a Super Admin', () => {
    expect(isSuperAdmin(superAdmin)).toBe(true);
    expect(isSuperAdmin(scopedMail)).toBe(false);
    expect(isSuperAdmin(reviewer)).toBe(false);
  });

  it('a Super Admin can reach every section', () => {
    expect(canAdminSection(superAdmin, 'mail')).toBe(true);
    expect(canAdminSection(superAdmin, 'users')).toBe(true);
    expect(canAdminSection(superAdmin, 'audit')).toBe(true);
  });

  it('a scoped admin can reach only their granted sections', () => {
    expect(canAdminSection(scopedMail, 'mail')).toBe(true);
    expect(canAdminSection(scopedMail, 'marketplace')).toBe(true);
    expect(canAdminSection(scopedMail, 'users')).toBe(false);
    expect(canAdminSection(scopedMail, 'security')).toBe(false);
  });

  it('non-admins never have back-end access', () => {
    expect(canAdminSection(reviewer, 'mail')).toBe(false);
    expect(canAdminSection(dealerA, 'mail')).toBe(false);
    expect(hasAnyAdminSection(reviewer)).toBe(false);
  });

  it('hasAnyAdminSection reflects super or any granted section', () => {
    expect(hasAnyAdminSection(superAdmin)).toBe(true);
    expect(hasAnyAdminSection(scopedMail)).toBe(true);
    expect(hasAnyAdminSection(scopedNone)).toBe(false);
  });
});
