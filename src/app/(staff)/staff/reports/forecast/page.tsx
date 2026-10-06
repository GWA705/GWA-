import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { salesForecast } from '@/lib/reporting/salesForecast';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { SalesForecastView } from '@/components/reporting/SalesForecastView';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

export const dynamic = 'force-dynamic';

/**
 * Admin-side Sales forecast — the owner Forecast report, but across any office
 * (or all offices). Mirrors the dealer-owner forecast; internal admins only.
 */
export default async function StaffForecastPage({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: 'All offices' }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? 'All offices';

  const rows = await reportDataset(officeId === ALL_OFFICES ? {} : { dealerIds: [officeId] });
  const data = salesForecast(rows);

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

      <ReportHeader org={officeName} title="Sales forecast" generated={`Generated ${reportGeneratedLabel()}`} />
      <SalesForecastView data={data} />
      <ReportStamp brand="Georgian Water & Air" generated={`Generated ${reportGeneratedLabel()}`} />
    </div>
  );
}
