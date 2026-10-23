import { NextRequest, NextResponse } from 'next/server';
import { requireDealerAccess } from '@/lib/session';
import { canViewAllLeads } from '@/lib/reporting/access';
import { canViewReport } from '@/lib/reporting/visibility';
import { buildLeadsReport, leadsPeriodWindow } from '@/lib/reporting/leadsReport';
import { buildLeadsPdf } from '@/lib/reporting/leadsPdf';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Download the Leads report (all offices) as a real PDF, scoped to the chosen
 * period. Same access as the on-screen report (Leads-oversight grant). */
export async function GET(req: NextRequest) {
  const user = await requireDealerAccess();
  if (!(await canViewReport(user, 'allLeads'))) return new NextResponse('Not found', { status: 404 });
  const canAllLeads = await canViewAllLeads(user);
  // Fail closed: without the cross-office grant, a viewer must be tied to an
  // office, so scopeDealerId can never fall back to null (= every office's leads).
  if (!canAllLeads && !user.dealerId) return new NextResponse('Not found', { status: 404 });

  const p = req.nextUrl.searchParams.get('p');
  const period = p === 'week' || p === 'month' ? p : 'all';
  const offset = Number.parseInt(req.nextUrl.searchParams.get('o') ?? '0', 10) || 0;
  const report = await buildLeadsReport(new Date().toISOString(), {
    ...leadsPeriodWindow(period, offset),
    scopeDealerId: canAllLeads ? null : user.dealerId,
  });

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
