import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { canViewLeadershipSnapshot } from '@/lib/reporting/access';
import { buildLeadsReport, leadsPeriodWindow } from '@/lib/reporting/leadsReport';
import { buildLeadsPdf } from '@/lib/reporting/leadsPdf';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Download the Leads report as a real PDF (staff), scoped to the chosen period. */
export async function GET(req: NextRequest) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReport(user, 'staffLeads'))) return new NextResponse('Not found', { status: 404 });

  const p = req.nextUrl.searchParams.get('p');
  const period = p === 'week' || p === 'month' ? p : 'all';
  const offset = Number.parseInt(req.nextUrl.searchParams.get('o') ?? '0', 10) || 0;
  const report = await buildLeadsReport(new Date().toISOString(), leadsPeriodWindow(period, offset));

  const t = getT();
  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const pdf = await buildLeadsPdf(report, {
    brandName: 'Georgian Water & Air',
    title: t('download.leadsPdf.title'),
    periodLabel: report.periodLabel,
    generated,
    footer: t('download.leadsPdf.footer'),
    t,
  });
  const suffix = report.periodLabel ? '-' + report.periodLabel.replace(/[^a-z0-9]+/gi, '-') : '';
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="GWA-leads-report${suffix}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
