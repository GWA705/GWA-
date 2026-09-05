import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { CustomReportBuilder } from '@/components/reporting/CustomReportBuilder';
import { DealerReportTabs } from '../DealerReportTabs';

export const dynamic = 'force-dynamic';

export default async function DealerCustomReport() {
  const user = await requireDealerAccess();
  // Owner-only + office reports enabled by an admin (same gate as pricing).
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const rows = await reportDataset({ dealerIds: [user.dealerId] });

  return (
    <div className="space-y-5">
      <DealerReportTabs active="custom" showOwner />
      <CustomReportBuilder rows={rows} />
    </div>
  );
}
