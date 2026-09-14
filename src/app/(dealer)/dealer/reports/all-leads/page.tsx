import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewAllLeads } from '@/lib/reporting/access';
import { buildLeadsReport, leadsPeriodWindow } from '@/lib/reporting/leadsReport';
import { LeadsReportView } from '@/app/(staff)/staff/reports/LeadsReportView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';
import { LeadsPeriodControls } from '@/components/reporting/LeadsPeriodControls';

export const dynamic = 'force-dynamic';

/** All-office leads report — for the "Leads oversight" grant (canViewAllLeads).
 * Every dealer's HD leads by office, outcomes and No-Good. Filterable by week or
 * month; printable/emailable for that period. */
export default async function DealerAllLeadsPage({ searchParams }: { searchParams: { p?: string; o?: string } }) {
  const user = await requireDealerAccess();
  if (!(await canViewAllLeads(user))) notFound();

  const t = getT();
  const period = searchParams.p === 'week' || searchParams.p === 'month' ? searchParams.p : 'all';
  const offset = Number.parseInt(searchParams.o ?? '0', 10) || 0;
  const win = leadsPeriodWindow(period, offset);
  const report = await buildLeadsReport(new Date().toISOString(), win);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="allLeads" />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <LeadsPeriodControls basePath="/dealer/reports/all-leads" period={period} offset={offset} />
        <ReportActions title={t('reports.tabAllLeads')} />
      </div>
      <div className="print-sheet space-y-5">
        <LeadsReportView report={report} />
        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
      </div>
    </div>
  );
}
