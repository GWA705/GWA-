import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { buildOfficeProjection } from '@/lib/reporting/salesProjectionData';
import { buildProjectionPdf, projectionNotes } from '@/lib/reporting/projectionPdf';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Download the Sales projection as a PDF (admin). Mirrors the page's params. */
export async function GET(req: NextRequest) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) return new NextResponse('Not found', { status: 404 });

  const t = getT();
  const q = req.nextUrl.searchParams;
  const offices = await listReportOffices();
  const office = q.get('office') || ALL_OFFICES;
  const officeId = office === ALL_OFFICES || offices.some((o) => o.dealerId === office) ? office : ALL_OFFICES;
  const officeName = officeId === ALL_OFFICES ? t('reportsUi.common.allOffices') : offices.find((o) => o.dealerId === officeId)?.name ?? officeId;
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(q.get('year') || '') ? Number(q.get('year')) : thisYear;
  const growth = /^-?\d{1,3}$/.test(q.get('growth') || '') ? Number(q.get('growth')) : undefined;

  const { data, configured } = await buildOfficeProjection(year, officeId, growth);
  if (!configured) return new NextResponse('The sales journal is not connected for this year.', { status: 404 });

  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const pdf = await buildProjectionPdf(data, {
    brandName: 'Georgian Water & Air',
    scopeLabel: officeName,
    generated,
    footer: 'GWA Portal · Georgian Water & Air',
    notes: projectionNotes(data, t),
  });
  const fname = `GWA-sales-projection-${year}-${officeName.replace(/[^a-z0-9]+/gi, '-')}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
