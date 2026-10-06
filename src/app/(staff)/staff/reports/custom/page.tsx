import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { CustomReportBuilder } from '@/components/reporting/CustomReportBuilder';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

export const dynamic = 'force-dynamic';

/**
 * Admin-side Custom report builder — the owner ad-hoc builder, across any office
 * (or all offices). Saved reports stay a dealer-side feature; this is for ad-hoc
 * analysis, so no saved list is passed. Internal admins only.
 */
export default async function StaffCustomReportPage({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: 'All offices' }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? 'All offices';

  const rows = await reportDataset(officeId === ALL_OFFICES ? {} : { dealerIds: [officeId] });

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">Office</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {choices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary h-10">View</button>
      </form>

      <ReportHeader org={officeName} title="Custom report" generated={`Generated ${reportGeneratedLabel()}`} />
      <CustomReportBuilder rows={rows} saved={[]} />
      <ReportStamp brand="Georgian Water & Air" generated={`Generated ${reportGeneratedLabel()}`} />
    </div>
  );
}
