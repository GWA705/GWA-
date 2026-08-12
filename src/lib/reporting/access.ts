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

/** Can the user open the internal Reports area at all? */
export async function canViewReportsArea(user: SessionUser): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  if (!isInternal(user)) return false;
  if (canAdminSection(user, 'reports')) return true;
  // Otherwise only if they hold a specific report grant.
  return canViewLeadershipSnapshot(user);
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
