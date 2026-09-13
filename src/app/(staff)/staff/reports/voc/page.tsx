import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { loadVocReport } from '@/lib/reporting/voc';
import { VocReportView } from '@/components/reporting/VocReportView';
import { VocUpload } from './VocUpload';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Voice of the Customer — all offices (staff/admin). Admins can import the HD
 * export; everyone with reports access sees the office + rep breakdown. */
export default async function StaffVocPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const report = await loadVocReport();
  const canUpload = user.role === 'ADMIN';

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">{t('staffReports.backAllReports')}</Link>
      <SectionHero eyebrow={t('voc.eyebrow')} title={t('voc.title')} subtitle={t('voc.subtitleAll')} />

      {canUpload && <VocUpload />}

      {report.lastImportedAt && (
        <p className="text-xs text-gray-400">
          {t('voc.lastImported')}: {report.lastImportedAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}

      <VocReportView report={report} />
    </div>
  );
}
