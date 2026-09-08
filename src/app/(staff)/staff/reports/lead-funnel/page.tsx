import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewLeadershipSnapshot } from '@/lib/reporting/access';
import { buildLeadsReport } from '@/lib/reporting/leadsReport';
import { LeadFunnelView } from './LeadFunnelView';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LeadFunnelPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewLeadershipSnapshot(user))) notFound();

  const t = getT();
  const report = await buildLeadsReport(new Date().toISOString());

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        {t('staffReports.backAllReports')}
      </Link>

      <SectionHero
        eyebrow={t('leadFunnel.eyebrow')}
        title={t('leadFunnel.title')}
        subtitle={t('leadFunnel.subtitle')}
      />

      <LeadFunnelView report={report} />
    </div>
  );
}
