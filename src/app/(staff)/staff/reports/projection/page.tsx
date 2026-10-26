import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { buildOfficeProjection } from '@/lib/reporting/salesProjectionData';
import { EARLIEST_JOURNAL_YEAR } from '@/lib/reporting/journalRead';
import { listReportOffices, ALL_OFFICES, officeOptionLabel } from '@/lib/reporting/monthly';
import { SalesProjectionView } from '@/components/reporting/SalesProjectionView';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Admin Sales projection — year-end revenue estimate across any office (or all
 * offices), built on the sales journal (paid gross, by Date Paid) so the actual
 * months reconcile exactly with the Total Sales / Monthly reports. A future year
 * (next year) becomes a forward plan grown by the year-over-year trend, with an
 * editable Growth %, for presenting targets to Home Depot.
 */
export default async function StaffProjectionPage({ searchParams }: { searchParams: { office?: string; year?: string; growth?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();
  const choices = [{ dealerId: ALL_OFFICES, name: t('reportsUi.common.allOffices'), archived: false }, ...offices];
  const officeId = choices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : ALL_OFFICES;
  const officeName = choices.find((o) => o.dealerId === officeId)?.name ?? t('reportsUi.common.allOffices');

  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(searchParams.year || '') ? Number(searchParams.year) : thisYear;
  const years: number[] = [];
  for (let y = thisYear + 1; y >= EARLIEST_JOURNAL_YEAR; y -= 1) years.push(y); // next year first (forward plan)
  const growth = /^-?\d{1,3}$/.test(searchParams.growth || '') ? Number(searchParams.growth) : undefined;

  const { data, configured } = await buildOfficeProjection(year, officeId, growth);

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
        <div>
          <label className="label" htmlFor="year">{t('salesProjection.yearLabel')}</label>
          <select id="year" name="year" defaultValue={String(year)} className="input">
            {years.map((y) => <option key={y} value={y}>{y}{y > thisYear ? ' ★' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="growth">{t('salesProjection.growthFieldLabel')}</label>
          <input id="growth" name="growth" type="number" min={-50} max={100} defaultValue={data.isFuture ? String(data.growthPct) : ''} placeholder="auto" className="input w-28" />
        </div>
        <button type="submit" className="btn-primary h-10">{t('common.view')}</button>
      </form>

      <ReportHeader org={officeName} title={t('reportsUi.projection.title')} generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />

      {!configured ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{t('salesProjection.notConfigured')}</div>
      ) : (
        <SalesProjectionView data={data} />
      )}

      <ReportStamp brand="Georgian Water & Air" generated={t('reportsUi.common.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
