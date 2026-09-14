import { NextRequest, NextResponse } from 'next/server';
import { requireDealerAccess } from '@/lib/session';
import { canViewAllLeads } from '@/lib/reporting/access';
import { buildLeadsReport, leadsPeriodWindow } from '@/lib/reporting/leadsReport';
import { buildLeadsPdf } from '@/lib/reporting/leadsPdf';

export const dynamic = 'force-dynamic';

/** Download the Leads report (all offices) as a real PDF, scoped to the chosen
 * period. Same access as the on-screen report (Leads-oversight grant). */
export async function GET(req: NextRequest) {
  const user = await requireDealerAccess();
  if (!(await canViewAllLeads(user))) return new NextResponse('Not found', { status: 404 });

  const p = req.nextUrl.searchParams.get('p');
  const period = p === 'week' || p === 'month' ? p : 'all';
  const offset = Number.parseInt(req.nextUrl.searchParams.get('o') ?? '0', 10) || 0;
  const report = await buildLeadsReport(new Date().toISOString(), leadsPeriodWindow(period, offset));

  const generated = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  const pdf = await buildLeadsPdf(report, {
    brandName: 'Georgian Water & Air',
    title: 'Leads report',
    periodLabel: report.periodLabel,
    generated,
    footer: 'GWA Portal · Georgian Water & Air',
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
