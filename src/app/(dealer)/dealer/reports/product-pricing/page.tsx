import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { productPricing } from '@/lib/reporting/productPricing';
import { ProductPricingReport } from '@/components/reporting/ProductPricingReport';
import { DealerReportTabs } from '../DealerReportTabs';

export const dynamic = 'force-dynamic';

export default async function DealerProductPricingReport() {
  const user = await requireDealerAccess();
  // Owner-only + office must have reports enabled by an admin.
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const data = await productPricing({ dealerIds: [user.dealerId] });

  return (
    <div className="space-y-5">
      <DealerReportTabs active="pricing" showPricing />
      <ProductPricingReport data={data} scopeLabel="Your office" />
    </div>
  );
}
