import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { projectYear } from '@/lib/reporting/salesProjection';
import { journalMonthlyPaid } from '@/lib/reporting/salesProjectionData';
import { EARLIEST_JOURNAL_YEAR } from '@/lib/reporting/journalRead';
import { SalesProjectionView } from '@/components/reporting/SalesProjectionView';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { DealerReportTabs } from '../DealerReportTabs';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * Dealer Sales projection — this office's own year-end revenue estimate, on the
 * same basis as their Total/Monthly reports (paid gross, by Date Paid). Scoped
 * strictly to the signed-in user's office (user.dealerId); never cross-office.
 */
export default async function DealerSalesProjection({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireDealerAccess();
  if (!(await canViewReport(user, 'projection')) || !user.dealerId) notFound();

  const t = getT();
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(searchParams.year || '') ? Number(searchParams.year) : thisYear;
  const years: number[] = [];
  for (let y = thisYear; y >= EARLIEST_JOURNAL_YEAR; y -= 1) years.push(y);

  const [cur, prior, brand] = await Promise.all([
    journalMonthlyPaid(year, user.dealerId),
    journalMonthlyPaid(year - 1, user.dealerId),
    getDealerReportBrand(user.dealerId),
  ]);
  const data = projectYear(cur.months, prior.months, year);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="projection" showOwner />
      <ReportHeader
        org={brand.name}
        logoUrl={brand.logoUrl}
        title={t('reportsUi.projection.title')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="year">{t('salesProjection.yearLabel')}</label>
          <select id="year" name="year" defaultValue={String(year)} className="input">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary h-10">{t('common.view')}</button>
      </form>

      {!cur.configured ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{t('salesProjection.notConfigured')}</div>
      ) : (
        <SalesProjectionView data={data} />
      )}

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
