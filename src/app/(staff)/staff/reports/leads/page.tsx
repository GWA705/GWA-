import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewLeadershipSnapshot } from '@/lib/reporting/access';
import { buildLeadsReport } from '@/lib/reporting/leadsReport';
import { LeadsReportView } from '../LeadsReportView';

export const dynamic = 'force-dynamic';

export default async function LeadsReportPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewLeadershipSnapshot(user))) notFound();

  const report = await buildLeadsReport(new Date().toISOString());

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

      <LeadsReportView report={report} />
    </div>
  );
}
