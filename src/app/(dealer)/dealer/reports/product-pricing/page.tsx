import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { productPricing } from '@/lib/reporting/productPricing';
import { ProductPricingReport } from '@/components/reporting/ProductPricingReport';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { DealerReportTabs } from '../DealerReportTabs';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function DealerProductPricingReport() {
  const user = await requireDealerAccess();
  // Owner-only + office must have reports enabled by an admin.
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const t = getT();
  const data = await productPricing({ dealerIds: [user.dealerId] });
  const brand = await getDealerReportBrand(user.dealerId);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="pricing" showOwner />
      <ReportHeader
        org={brand.name}
        logoUrl={brand.logoUrl}
        title={t('reports.tabPricing')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />
      <ProductPricingReport data={data} scopeLabel="Your office" />
      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
