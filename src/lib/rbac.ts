import type { Role } from '@prisma/client';
import type { SessionUser } from './session';

/**
 * Central authorization helpers. These are the single source of truth for
 * "who can see/do what" and are enforced server-side (never trust the UI).
 */

export function isInternal(user: SessionUser): boolean {
  return user.role === 'REVIEWER' || user.role === 'ADMIN';
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}

/**
 * A Super Admin: an administrator with full back-end access who is the only one
 * allowed to grant/revoke other admins' section access.
 */
export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN' && user.superAdmin === true;
}

/**
 * Can this user reach a given back-end section (a key from ADMIN_SECTIONS)?
 * Only admins have back-end access; a Super Admin has every section, a scoped
 * admin only the keys in their adminSections list. Enforced server-side on
 * every admin route — never trust the filtered nav alone.
 */
export function canAdminSection(user: SessionUser, key: string): boolean {
  if (user.role !== 'ADMIN') return false;
  if (user.superAdmin) return true;
  return (user.adminSections ?? []).includes(key);
}

/** True when an admin can reach at least one back-end section. */
export function hasAnyAdminSection(user: SessionUser): boolean {
  if (user.role !== 'ADMIN') return false;
  return user.superAdmin || (user.adminSections ?? []).length > 0;
}

export function isDealer(user: SessionUser): boolean {
  return user.role === 'DEALER_USER';
}

/**
 * Tenant isolation: can this user access an application belonging to
 * `applicationDealerId`? Dealer users are restricted to their own dealer;
 * internal staff can access all.
 */
export function canAccessApplication(
  user: SessionUser,
  applicationDealerId: string,
): boolean {
  if (isInternal(user)) return true;
  return user.dealerId != null && user.dealerId === applicationDealerId;
}

/** Build a Prisma `where` clause that scopes application queries to the user. */
export function applicationScopeWhere(user: SessionUser): { dealerId?: string } {
  if (isInternal(user)) return {};
  // A dealer with no dealerId should see nothing — impossible id guards that.
  return { dealerId: user.dealerId ?? '__none__' };
}

/**
 * Scope for the DEALER portal specifically — always the user's own dealer, even
 * for an internal user who is linked to a dealer (the "switch portals" case).
 * This keeps the dealer view limited to that dealership's deals.
 */
export function dealerPortalScopeWhere(user: SessionUser): { dealerId: string } {
  return { dealerId: user.dealerId ?? '__none__' };
}

/** Can this user act on this application within the DEALER portal? */
export function canAccessAsDealer(user: SessionUser, applicationDealerId: string): boolean {
  return user.dealerId != null && user.dealerId === applicationDealerId;
}

export function assert(condition: boolean, message = 'Forbidden'): asserts condition {
  if (!condition) {
    const err = new Error(message) as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'DEALER_USER':
      return 'Dealer';
    case 'REVIEWER':
      return 'Reviewer';
    case 'ADMIN':
      return 'Administrator';
  }
}
