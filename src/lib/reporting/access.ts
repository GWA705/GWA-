import 'server-only';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/session';
import { isSuperAdmin, isInternal, canAdminSection } from '@/lib/rbac';

/**
 * Access control for the reporting area.
 *
 * Two distinct grants:
 *  - Reports AREA  — can the user open /staff/reports at all (internal). Granted
 *    by the `reports` admin section, or implied by any report grant below.
 *  - Leadership snapshot — the company-wide, all-dealers weekly report. This is
 *    the sensitive one: Super Admin only, OR an explicit per-user grant
 *    (User.canViewLeadershipReport). Distributors and scoped admins do NOT see
 *    cross-dealer totals unless granted.
 *
 * Dealer-facing reports (a future surface) are always tenant-isolated to the
 * user's own dealership — a distributor sees only their own dealer's numbers.
 */

/** The company-wide weekly leadership snapshot (all dealers / national). */
export async function canViewLeadershipSnapshot(user: SessionUser): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isInternal(user)) return false; // dealers never see company-wide totals
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { canViewLeadershipReport: true },
  });
  return !!me?.canViewLeadershipReport;
}

/** The admin Dealer Snapshot report (cross-dealer sold/paid/pending). */
export async function canViewDealerSnapshot(user: SessionUser): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isInternal(user)) return false; // dealers never see cross-dealer totals
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { canViewDealerSnapshot: true },
  });
  return !!me?.canViewDealerSnapshot;
}

/** Can the user open the internal Reports area at all? */
export async function canViewReportsArea(user: SessionUser): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isInternal(user)) return false;
  if (canAdminSection(user, 'reports')) return true;
  // Otherwise only if they hold a specific report grant.
  if (await canViewLeadershipSnapshot(user)) return true;
  return canViewDealerSnapshot(user);
}

/**
 * The owner-only product-pricing report on the dealer side. Two gates that must
 * BOTH hold, so it's clear where the control is:
 *   1. the user is the office OWNER (User.isDistributor — the "main contact"
 *      login), so regular office staff never see it; and
 *   2. an admin has switched the office's reports on (Dealer.reportsEnabled),
 *      so it's off by default until GWA enables it for that office.
 * Scoped to the owner's own office only. Internal staff use the staff report.
 */
export async function canViewOwnerPricingReport(user: SessionUser): Promise<boolean> {
  if (user.role !== 'DEALER_USER') return false;
  if (!user.isDistributor) return false; // owner login only
  if (!user.dealerId) return false;
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { dealer: { select: { reportsEnabled: true } } },
  });
  return !!me?.dealer?.reportsEnabled; // admin-enabled per office
}

/** Dealer-facing reports (own office only). Internal staff always qualify. */
export async function hasDealerReportAccess(user: SessionUser): Promise<boolean> {
  if (isInternal(user)) return true;
  if (user.role !== 'DEALER_USER') return false;
  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { canViewReports: true, dealer: { select: { reportsEnabled: true } } },
  });
  return !!(me?.canViewReports || me?.dealer?.reportsEnabled);
}
