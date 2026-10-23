import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewReport } from '@/lib/reporting/visibility';
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
  if (!(await canViewReport(user, 'leadFunnel'))) notFound();
  const canAllLeads = await canViewAllLeads(user);
  // Fail closed: without the cross-office grant, a viewer must be tied to an
  // office, so scopeDealerId can never fall back to null (= every office's leads).
  if (!canAllLeads && !user.dealerId) notFound();

  const t = getT();
  const report = await buildLeadsReport(new Date().toISOString(), {
    scopeDealerId: canAllLeads ? null : user.dealerId,
  });

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
