import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { certificatePdf } from '@/lib/training-pdf';

export const dynamic = 'force-dynamic';

// Serves the branded certificate PDF (same design as the emailed one) for a
// completed training. Scoped: a dealer can only pull up their own office's certs.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireDealerAccess();
  const cert = await prisma.trainingCertification.findUnique({ where: { id: params.id } });
  if (!cert || cert.dealerId !== user.dealerId) return new Response('Not found', { status: 404 });
  const dealer = await prisma.dealer.findUnique({ where: { id: cert.dealerId }, select: { name: true } });

  const bytes = await certificatePdf({
    traineeName: cert.traineeName,
    office: dealer?.name || 'Georgian Water & Air',
    startDate: cert.startDate,
    completedDate: cert.createdAt.toLocaleDateString(cert.language === 'fr' ? 'fr-CA' : 'en-CA'),
    signature: cert.signatureName,
    version: cert.contentVersion,
  });
  const safe = (cert.traineeName || 'trainee').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trainee';
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="GWA-Certificate-${safe}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
