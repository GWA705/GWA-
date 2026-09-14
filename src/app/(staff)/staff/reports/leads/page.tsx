import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { canViewLeadershipSnapshot } from '@/lib/reporting/access';
import { buildLeadsReport, leadsPeriodWindow } from '@/lib/reporting/leadsReport';
import { LeadsReportView } from '../LeadsReportView';
import { LeadsPeriodControls } from '@/components/reporting/LeadsPeriodControls';

export const dynamic = 'force-dynamic';

export default async function LeadsReportPage({ searchParams }: { searchParams: { p?: string; o?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReport(user, 'staffLeads'))) notFound();

  const period = searchParams.p === 'week' || searchParams.p === 'month' ? searchParams.p : 'all';
  const offset = Number.parseInt(searchParams.o ?? '0', 10) || 0;
  const report = await buildLeadsReport(new Date().toISOString(), leadsPeriodWindow(period, offset));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← Reports</Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">Leads report</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every HD lead broken down by dealer — how many, what type, No-Good, and where each call landed
          (NA, LM, Spoke, Booked, Sold, NI). Search a dealer, or read the group totals up top.
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <LeadsPeriodControls basePath="/staff/reports/leads" period={period} offset={offset} />
        <a href={`/staff/reports/leads/pdf?p=${period}&o=${offset}`} className="btn-secondary text-sm" title="Download this report as a PDF file">
          ⬇ Download PDF
        </a>
      </div>

      <LeadsReportView report={report} />
    </div>
  );
}
