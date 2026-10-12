import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { listReportOffices, ALL_OFFICES } from '@/lib/reporting/monthly';
import { CustomReportBuilder } from '@/components/reporting/CustomReportBuilder';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Admin-side Custom report builder — the owner ad-hoc builder, across any office
 * (or all offices). Saved reports stay a dealer-side feature; this is for ad-hoc
 * analysis, so no saved list is passed. Internal admins only.
 */
export default async function StaffCustomReportPage({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: t('reportsUi.common.allOffices') }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? t('reportsUi.common.allOffices');

  const rows = await reportDataset(officeId === ALL_OFFICES ? {} : { dealerIds: [officeId] });

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">{t('reportsUi.common.backAllReports')}</Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('reportsUi.common.office')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {choices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary h-10">{t('common.view')}</button>
      </form>

      <ReportHeader org={officeName} title={t('reportsUi.custom.title')} generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />
      <CustomReportBuilder rows={rows} saved={[]} />
      <ReportStamp brand="Georgian Water & Air" generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
