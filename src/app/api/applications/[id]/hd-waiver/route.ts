import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { decryptOptional } from '@/lib/crypto';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { fillHdWaiver, waiverInstallerCompany } from '@/lib/hdWaiver';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const clean = (s: string) => (s || '').replace(/[^a-zA-Z0-9]+/g, '') || 'job';

/**
 * Per-job Home Depot waiver, PRE-FILLED. Instead of a blank form, the dealer (and
 * GWA staff) download the "Customer Signoff of Completion / Installer's Waiver"
 * with this deal's Store No., Customer Name, Job Site Address and the dealer's
 * business name already stamped in — signatures/dates stay blank for on-site.
 *
 * Access: the owning dealer, or any internal staff (canAccessApplication).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const app = await prisma.application.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      dealerId: true,
      applicantFirstName: true,
      applicantLastName: true,
      applicantAddressEnc: true,
      applicantCity: true,
      applicantPostal: true,
      province: true,
      homeDepotStore: { select: { number: true } },
    },
  });
  if (!app || !canAccessApplication(session, app.dealerId)) {
    return new NextResponse('Not found', { status: 404 });
  }

  // The "Installer's Company Name" is the office's own business name (same source
  // the dealer's branded reports use), falling back to the dealer name — except
  // where an office signs the HD waiver under Georgian Water and Air (see
  // waiverInstallerCompany); that override applies to the waiver only.
  const brand = await getDealerReportBrand(app.dealerId);
  const installerCompany = waiverInstallerCompany(brand.name);

  const street = decryptOptional(app.applicantAddressEnc) ?? '';
  const jobSiteAddress = [street, app.applicantCity, app.province, app.applicantPostal]
    .map((s) => (s ?? '').toString().trim())
    .filter(Boolean)
    .join(', ');
  const customerName = `${app.applicantFirstName ?? ''} ${app.applicantLastName ?? ''}`.trim();

  const bytes = await fillHdWaiver({
    storeNumber: app.homeDepotStore?.number ?? null,
    customerName: customerName || null,
    jobSiteAddress: jobSiteAddress || null,
    installerCompany,
  });

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'Application',
    entityId: app.id,
    detail: 'HD waiver downloaded (pre-filled)',
  });

  const fname = `HD-Waiver-${clean(app.applicantLastName || customerName)}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
