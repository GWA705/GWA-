import { NextRequest, NextResponse } from 'next/server';
import { requireDealerAccess } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { buildOfficeProjection } from '@/lib/reporting/salesProjectionData';
import { buildProjectionPdf, projectionNotes } from '@/lib/reporting/projectionPdf';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Download this office's Sales projection as a PDF. Scoped to the signed-in office. */
export async function GET(req: NextRequest) {
  const user = await requireDealerAccess();
  if (!(await canViewReport(user, 'projection')) || !user.dealerId) return new NextResponse('Not found', { status: 404 });

  const t = getT();
  const q = req.nextUrl.searchParams;
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(q.get('year') || '') ? Number(q.get('year')) : thisYear;
  const growth = /^-?\d{1,3}$/.test(q.get('growth') || '') ? Number(q.get('growth')) : undefined;

  const [{ data, configured }, brand] = await Promise.all([
    buildOfficeProjection(year, user.dealerId, growth),
    getDealerReportBrand(user.dealerId),
  ]);
  if (!configured) return new NextResponse('The sales journal is not connected for this year.', { status: 404 });

  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const pdf = await buildProjectionPdf(data, {
    brandName: brand.name || 'Georgian Water & Air',
    scopeLabel: brand.name || '',
    generated,
    footer: 'GWA Portal · Georgian Water & Air',
    notes: projectionNotes(data, t),
  });
  const fname = `sales-projection-${year}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
