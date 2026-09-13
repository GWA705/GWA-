import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { loadVocReport } from '@/lib/reporting/voc';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { VocReportView } from '@/components/reporting/VocReportView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Dealer "VOC" — completed Home Depot Voice-of-the-Customer reviews for the
 * dealer's own office, broken down by sales rep. Printable and emailable. */
export default async function DealerVocPage() {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const brand = await getDealerReportBrand(user.dealerId);
  const report = await loadVocReport({ dealerId: user.dealerId });

  return (
    <div className="space-y-5">
      <DealerReportTabs active="voc" />
      <div className="no-print flex justify-end">
        <ReportActions title={t('voc.title')} />
      </div>
      <div className="print-sheet space-y-5">
        <ReportHeader
          org={brand.name}
          logoUrl={brand.logoUrl}
          title={t('voc.title')}
          scope={t('voc.subtitleDealer')}
          generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
        />
        <VocReportView report={report} singleOffice />
        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
      </div>
    </div>
  );
}
