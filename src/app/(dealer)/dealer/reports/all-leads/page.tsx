import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewAllLeads } from '@/lib/reporting/access';
import { buildLeadsReport } from '@/lib/reporting/leadsReport';
import { LeadsReportView } from '@/app/(staff)/staff/reports/LeadsReportView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** All-office leads report — for the "Leads oversight" grant (canViewAllLeads).
 * Every dealer's HD leads by office, outcomes and No-Good. Printable/emailable. */
export default async function DealerAllLeadsPage() {
  const user = await requireDealerAccess();
  if (!(await canViewAllLeads(user))) notFound();

  const t = getT();
  const report = await buildLeadsReport(new Date().toISOString());

  return (
    <div className="space-y-5">
      <DealerReportTabs active="allLeads" />
      <div className="no-print flex justify-end">
        <ReportActions title={t('reports.tabAllLeads')} />
      </div>
      <div className="print-sheet space-y-5">
        <LeadsReportView report={report} />
        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
      </div>
    </div>
  );
}
