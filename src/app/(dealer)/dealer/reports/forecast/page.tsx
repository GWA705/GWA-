import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { salesForecast } from '@/lib/reporting/salesForecast';
import { SalesForecastView } from '@/components/reporting/SalesForecastView';
import { DealerReportTabs } from '../DealerReportTabs';

export const dynamic = 'force-dynamic';

export default async function DealerSalesForecast() {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const rows = await reportDataset({ dealerIds: [user.dealerId] });
  const data = salesForecast(rows);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="forecast" showOwner />
      <SalesForecastView data={data} />
    </div>
  );
}
