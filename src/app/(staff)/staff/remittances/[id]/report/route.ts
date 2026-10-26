import { NextResponse } from 'next/server';
import { requireStaffSection } from '@/lib/session';
import { buildRemittanceReportForId } from '@/lib/remittanceReport';

export const dynamic = 'force-dynamic';

/** Download/view the matched-remittance report PDF for one remittance. Staff only. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireStaffSection('remittances');
  const built = await buildRemittanceReportForId(params.id);
  if (!built) return new NextResponse('Remittance not found', { status: 404 });
  return new NextResponse(new Uint8Array(built.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${built.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
