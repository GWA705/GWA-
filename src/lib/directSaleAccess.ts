import { redirect } from 'next/navigation';
import { isInternal } from './rbac';
import { requireSession, type SessionUser } from './session';

/**
 * Who can use the "Direct sale" screen: the Georgian Water & Air internal team
 * ONLY — i.e. REVIEWER / ADMIN accounts.
 *
 * This is deliberately NOT grantable to any dealer. Direct sale is used only at
 * Georgian Water, nowhere else, so no DEALER_USER ever qualifies — not by a
 * per-user grant, and not while an admin is "viewing as" a dealer (impersonation
 * keeps the admin's role, so it's excluded explicitly). The feature is never
 * surfaced in the dealer portal.
 */
export function canEnterDirectSale(user: SessionUser): boolean {
  if (user.impersonating) return false;
  return isInternal(user);
}

/** Guard for the Direct sale page/actions — redirects if not permitted. */
export async function requireDirectSaleAccess(): Promise<SessionUser> {
  const session = await requireSession();
  if (!canEnterDirectSale(session)) redirect('/');
  return session;
}
