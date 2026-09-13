import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { loadVocReport } from '@/lib/reporting/voc';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { VocReportView } from '@/components/reporting/VocReportView';
import Link from 'next/link';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Dealer "VOC" — completed Home Depot Voice-of-the-Customer reviews for the
 * dealer's own office, broken down by sales rep. Printable and emailable. */
export default async function DealerVocPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const brand = await getDealerReportBrand(user.dealerId);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? '') ? searchParams.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? '') ? searchParams.to : undefined;
  const report = await loadVocReport({ dealerId: user.dealerId, from, to });

  return (
    <div className="space-y-5">
      <DealerReportTabs active="voc" />
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="from">{t('voc.dateFrom')}</label>
            <input type="date" id="from" name="from" defaultValue={from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">{t('voc.dateTo')}</label>
            <input type="date" id="to" name="to" defaultValue={to} className="input" />
          </div>
          <button type="submit" className="btn-primary">{t('reports.view')}</button>
          <Link href="/dealer/reports/voc?from=2026-01-01&to=2026-06-30" className="btn-secondary text-sm">{t('voc.contestPreset')}</Link>
          {(from || to) && <Link href="/dealer/reports/voc" className="btn-secondary text-sm">{t('voc.clearDates')}</Link>}
        </form>
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
