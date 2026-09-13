import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { salesForecast } from '@/lib/reporting/salesForecast';
import { SalesForecastView } from '@/components/reporting/SalesForecastView';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { DealerReportTabs } from '../DealerReportTabs';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function DealerSalesForecast() {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const t = getT();
  const rows = await reportDataset({ dealerIds: [user.dealerId] });
  const data = salesForecast(rows);
  const brand = await getDealerReportBrand(user.dealerId);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="forecast" showOwner />
      <ReportHeader
        org={brand.name}
        logoUrl={brand.logoUrl}
        title={t('reports.tabForecast')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />
      <SalesForecastView data={data} />
      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
