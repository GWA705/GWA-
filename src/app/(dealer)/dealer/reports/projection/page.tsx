import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { buildOfficeProjection } from '@/lib/reporting/salesProjectionData';
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
 * A future year becomes a forward plan with an editable Growth %.
 */
export default async function DealerSalesProjection({ searchParams }: { searchParams: { year?: string; growth?: string } }) {
  const user = await requireDealerAccess();
  if (!(await canViewReport(user, 'projection')) || !user.dealerId) notFound();

  const t = getT();
  const thisYear = new Date().getFullYear();
  const year = /^\d{4}$/.test(searchParams.year || '') ? Number(searchParams.year) : thisYear;
  const years: number[] = [];
  for (let y = thisYear + 1; y >= EARLIEST_JOURNAL_YEAR; y -= 1) years.push(y);
  const growth = /^-?\d{1,3}$/.test(searchParams.growth || '') ? Number(searchParams.growth) : undefined;

  const [{ data, configured }, brand] = await Promise.all([
    buildOfficeProjection(year, user.dealerId, growth),
    getDealerReportBrand(user.dealerId),
  ]);

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
            {years.map((y) => <option key={y} value={y}>{y}{y > thisYear ? ' ★' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="growth">{t('salesProjection.growthFieldLabel')}</label>
          <input id="growth" name="growth" type="number" min={-50} max={100} defaultValue={data.isFuture ? String(data.growthPct) : ''} placeholder="auto" className="input w-28" />
        </div>
        <button type="submit" className="btn-primary h-10">{t('common.view')}</button>
      </form>

      {!configured ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">{t('salesProjection.notConfigured')}</div>
      ) : (
        <SalesProjectionView data={data} />
      )}

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
