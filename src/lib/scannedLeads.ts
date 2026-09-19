import 'server-only';
import { prisma } from './db';
import type { ScannedLead } from '@prisma/client';
import type { SessionUser } from './session';
import { isInternalRole } from './constants';

/**
 * Data access for scanned water-test lead cards (see lib/leadScanner.ts for the
 * AI reader and the "Scanned leads" section of the Leads page for the UI).
 * Dealers see only their own office's cards; GWA staff see all.
 */

/** Resolve a Home Depot store number to the dealer that owns it, if any. */
export async function resolveDealerIdForStore(storeNumber: string | null | undefined): Promise<string | null> {
  const num = (storeNumber ?? '').trim();
  if (!num) return null;
  const store = await prisma.homeDepotStore.findFirst({ where: { number: num }, select: { dealerId: true } });
  return store?.dealerId ?? null;
}

/**
 * Whether this viewer sees EVERY office's cards. Internal staff (GWA reviewers /
 * admins) do — EXCEPT when an admin is currently "viewing as" a dealer, where they
 * must see exactly what that dealer sees (their own office only). Without this
 * guard, an admin previewing a dealer still saw every office's leads, because the
 * impersonation keeps the ADMIN role and only swaps in the dealer's dealerId.
 */
function seesAllScannedLeads(user: SessionUser): boolean {
  return isInternalRole(user.role) && !user.impersonating;
}

/** Cards for the Leads page, scoped to the viewer. Newest first. */
export async function listScannedLeads(user: SessionUser, limit = 200): Promise<ScannedLead[]> {
  // '__none__' can never match a real cuid, so a viewer with no dealerId (and no
  // all-access) sees nothing rather than every unassigned card.
  const where = seesAllScannedLeads(user) ? {} : { dealerId: user.dealerId ?? '__none__' };
  return prisma.scannedLead.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
}

/** Whether this viewer may see/act on a given card. */
export function canAccessScannedLead(user: SessionUser, lead: { dealerId: string | null }): boolean {
  if (seesAllScannedLeads(user)) return true;
  return !!user.dealerId && lead.dealerId === user.dealerId;
}

/** Fetch one card if the viewer is allowed to see it, else null. */
export async function getScannedLeadForViewer(id: string, user: SessionUser): Promise<ScannedLead | null> {
  const lead = await prisma.scannedLead.findUnique({ where: { id } });
  if (!lead) return null;
  return canAccessScannedLead(user, lead) ? lead : null;
}
