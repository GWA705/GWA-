import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewAllLeads } from '@/lib/reporting/access';
import { buildLeadsReport } from '@/lib/reporting/leadsReport';
import { LeadFunnelView } from '@/app/(staff)/staff/reports/lead-funnel/LeadFunnelView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Lead funnel (all offices) — for the "Leads oversight" grant (canViewAllLeads).
 * Where every office's leads land across the call stages. Printable/emailable. */
export default async function DealerLeadFunnelPage() {
  const user = await requireDealerAccess();
  if (!(await canViewAllLeads(user))) notFound();

  const t = getT();
  const report = await buildLeadsReport(new Date().toISOString());

  return (
    <div className="space-y-5">
      <DealerReportTabs active="leadFunnel" />
      <div className="no-print flex justify-end">
        <ReportActions title={t('reports.tabLeadFunnel')} />
      </div>
      <div className="print-sheet space-y-5">
        <LeadFunnelView report={report} />
        <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
      </div>
    </div>
  );
}
