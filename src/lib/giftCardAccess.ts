import { redirect } from 'next/navigation';
import { prisma } from './db';
import { isSuperAdmin, canAdminSection } from './rbac';
import { requireSession, type SessionUser } from './session';

function isInternal(user: SessionUser): boolean {
  return user.role === 'ADMIN' || user.role === 'REVIEWER';
}

/**
 * Who can work the water-test gift-card queue:
 *  - any Super Admin,
 *  - an admin holding the 'gift-cards' back-end section,
 *  - any internal user (reviewer/admin) with the per-user canManageGiftCards
 *    grant (set on Admin → Users).
 * Dealers never qualify — they only ever request cards from their own office.
 */
export async function canManageGiftCards(user: SessionUser): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isInternal(user)) return false;
  if (canAdminSection(user, 'gift-cards')) return true;
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { canManageGiftCards: true },
  });
  return !!me?.canManageGiftCards;
}

/** Guard for the gift-card queue page/actions — redirects if not permitted. */
export async function requireGiftCardAccess(): Promise<SessionUser> {
  const session = await requireSession();
  if (!(await canManageGiftCards(session))) redirect('/');
  return session;
}

/** Does this dealer have a gift-card update waiting (staff message/edit)? */
export async function dealerHasGiftCardUnread(dealerId: string): Promise<boolean> {
  const n = await prisma.giftCardRequest.count({ where: { dealerId, dealerUnread: true } });
  return n > 0;
}

/** Is there any gift-card request flagged for staff to look at? */
export async function staffHasGiftCardUnread(): Promise<boolean> {
  const n = await prisma.giftCardRequest.count({ where: { staffUnread: true } });
  return n > 0;
}
