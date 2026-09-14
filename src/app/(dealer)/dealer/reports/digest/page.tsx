import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { buildDealerDigest } from '@/lib/reporting/dealerDigest';
import { getDealerReportBrand } from '@/lib/reporting/dealerBrand';
import { DealerDigestView } from '@/components/reporting/DealerDigestView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Dealer "Snapshot" — the one-glance digest of this office's week or month
 * (leads + trend, financing incl. HD credit cards, VOC). Printable/emailable;
 * the same builder powers the scheduled email digest. */
export default async function DealerDigestPage({ searchParams }: { searchParams: { p?: string; o?: string } }) {
  const user = await requireDealerAccess();
  if (!(await canViewReport(user, 'digest')) || !user.dealerId) notFound();

  const t = getT();
  const period: 'week' | 'month' = searchParams.p === 'month' ? 'month' : 'week';
  const offset = Number.parseInt(searchParams.o ?? '0', 10) || 0;
  const brand = await getDealerReportBrand(user.dealerId);
  const digest = await buildDealerDigest(user.dealerId, period, offset);
  const qp = (o: number) => `/dealer/reports/digest?p=${period}&o=${o}`;

  return (
    <div className="space-y-5">
      <DealerReportTabs active="digest" />

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
            <Link href="/dealer/reports/digest?p=week&o=0" className={`rounded-md px-3 py-1 font-semibold ${period === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{t('funding.week')}</Link>
            <Link href="/dealer/reports/digest?p=month&o=0" className={`rounded-md px-3 py-1 font-semibold ${period === 'month' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>{t('funding.month')}</Link>
          </div>
          <Link href={qp(offset - 1)} className="btn-secondary text-sm">←</Link>
          {offset < 0 && <Link href={qp(offset + 1)} className="btn-secondary text-sm">→</Link>}
        </div>
        <ReportActions title={t('digest.title')} />
      </div>

      <div className="print-sheet space-y-5">
        <ReportHeader
          org={brand.name}
          logoUrl={brand.logoUrl}
          title={t('digest.title')}
          scope={digest.periodLabel}
          generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
        />
        <DealerDigestView digest={digest} />
        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
      </div>
    </div>
  );
}
