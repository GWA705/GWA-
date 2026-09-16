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

/** Cards for the Leads page, scoped to the viewer. Newest first. */
export async function listScannedLeads(user: SessionUser, limit = 200): Promise<ScannedLead[]> {
  const where = isInternalRole(user.role) ? {} : { dealerId: user.dealerId ?? '__none__' };
  return prisma.scannedLead.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
}

/** Whether this viewer may see/act on a given card. */
export function canAccessScannedLead(user: SessionUser, lead: { dealerId: string | null }): boolean {
  if (isInternalRole(user.role)) return true;
  return !!user.dealerId && lead.dealerId === user.dealerId;
}

/** Fetch one card if the viewer is allowed to see it, else null. */
export async function getScannedLeadForViewer(id: string, user: SessionUser): Promise<ScannedLead | null> {
  const lead = await prisma.scannedLead.findUnique({ where: { id } });
  if (!lead) return null;
  return canAccessScannedLead(user, lead) ? lead : null;
}
