import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { prisma } from '@/lib/db';
import { CustomReportBuilder } from '@/components/reporting/CustomReportBuilder';
import { DealerReportTabs } from '../DealerReportTabs';
import type { SavedReportVM, SavedReportConfig } from '../customActions';

export const dynamic = 'force-dynamic';

export default async function DealerCustomReport() {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const [rows, savedRows] = await Promise.all([
    reportDataset({ dealerIds: [user.dealerId] }),
    prisma.savedReport
      .findMany({ where: { dealerId: user.dealerId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, config: true } })
      .catch(() => []),
  ]);
  const saved: SavedReportVM[] = savedRows.map((r) => ({ id: r.id, name: r.name, config: r.config as unknown as SavedReportConfig }));

  return (
    <div className="space-y-5">
      <DealerReportTabs active="custom" showOwner />
      <CustomReportBuilder rows={rows} saved={saved} />
    </div>
  );
}
