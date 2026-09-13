import 'server-only';
import { prisma } from '@/lib/db';

export interface ReportBrand {
  /** The name shown in the report's top lockup. */
  name: string;
  /** Same-origin URL to the dealer's uploaded logo, or null to fall back to the GWA icon. */
  logoUrl: string | null;
}

/**
 * Branding for a dealer-facing report's TOP lockup: the office's own business
 * name and the logo they uploaded (falls back to the dealer's name, and to no
 * logo — the caller then shows the GWA icon). The report FOOTER stamp stays
 * "Georgian Water & Air" regardless — this only governs the header.
 *
 * Only use this on OWN-OFFICE reports. Cross-office reports (all-leads, lead
 * funnel) must keep the GWA branding since they aggregate every dealer.
 */
export async function getDealerReportBrand(dealerId: string): Promise<ReportBrand> {
  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: {
      name: true,
      profile: { select: { businessName: true, logoStorageKey: true, updatedAt: true } },
    },
  });
  const name = dealer?.profile?.businessName?.trim() || dealer?.name || 'Georgian Water & Air';
  const logoUrl =
    dealer?.profile?.logoStorageKey && dealer.profile.updatedAt
      ? `/api/dealer-profiles/${dealerId}/logo?v=${dealer.profile.updatedAt.getTime()}`
      : null;
  return { name, logoUrl };
}
