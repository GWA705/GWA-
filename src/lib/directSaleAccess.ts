import { redirect } from 'next/navigation';
import { prisma } from './db';
import { isInternal } from './rbac';
import { requireSession, type SessionUser } from './session';

/**
 * Who can use the "Direct sale" screen (enter a Georgian Water & Air in-store
 * walk-in and complete it straight to Funded + Paid):
 *  - any internal user (REVIEWER / ADMIN) — the GWA team — implicitly, and
 *  - a specific user holding the per-user `canEnterDirectSale` grant (set on
 *    Admin → Users), which lets a GWA office person use it even if they log in
 *    as a store (DEALER_USER) account.
 *
 * Regular dealers never qualify. This is the deliberate scope: Direct sale is a
 * Georgian Water & Air team tool, NOT a dealer feature, so it is never surfaced
 * on the shared dealer new-deal form — the grant is the only way a non-internal
 * user gets it.
 */
export async function canEnterDirectSale(user: SessionUser): Promise<boolean> {
  // While an admin is "viewing as" a dealer, they see the DEALER'S own view —
  // Direct sale is an internal GWA-team tool, so it must NOT appear (and must not
  // leak GWA direct sales into the dealer's scoped view). The internal role is
  // ignored during impersonation.
  if (user.impersonating) return false;
  if (isInternal(user)) return true;
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { canEnterDirectSale: true },
  });
  return !!me?.canEnterDirectSale;
}

/** Guard for the Direct sale page/actions — redirects if not permitted. */
export async function requireDirectSaleAccess(): Promise<SessionUser> {
  const session = await requireSession();
  if (!(await canEnterDirectSale(session))) redirect('/');
  return session;
}
