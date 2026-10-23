import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { salesForecast } from '@/lib/reporting/salesForecast';
import { listReportOffices, ALL_OFFICES, officeOptionLabel } from '@/lib/reporting/monthly';
import { SalesForecastView } from '@/components/reporting/SalesForecastView';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Admin-side Sales forecast — the owner Forecast report, but across any office
 * (or all offices). Mirrors the dealer-owner forecast; internal admins only.
 */
export default async function StaffForecastPage({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: t('reportsUi.common.allOffices'), archived: false }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? t('reportsUi.common.allOffices');

  const rows = await reportDataset(officeId === ALL_OFFICES ? {} : { dealerIds: [officeId] });
  const data = salesForecast(rows);

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">{t('reportsUi.common.backAllReports')}</Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('reportsUi.common.office')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {choices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{officeOptionLabel(o)}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary h-10">{t('common.view')}</button>
      </form>

      <ReportHeader org={officeName} title={t('reportsUi.forecast.title')} generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />
      <SalesForecastView data={data} />
      <ReportStamp brand="Georgian Water & Air" generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
