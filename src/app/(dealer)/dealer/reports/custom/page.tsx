import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { prisma } from '@/lib/db';
import { CustomReportBuilder } from '@/components/reporting/CustomReportBuilder';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { DealerReportTabs } from '../DealerReportTabs';
import { getT } from '@/i18n/server';
import type { SavedReportVM, SavedReportConfig } from '../customActions';

export const dynamic = 'force-dynamic';

export default async function DealerCustomReport() {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const t = getT();
  const brand = await getDealerReportBrand(user.dealerId);
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
      <ReportHeader
        org={brand.name}
        logoUrl={brand.logoUrl}
        title={t('reports.tabCustom')}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />
      <CustomReportBuilder rows={rows} saved={saved} />
      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
