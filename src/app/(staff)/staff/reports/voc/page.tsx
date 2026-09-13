import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { loadVocReport } from '@/lib/reporting/voc';
import { VocReportView } from '@/components/reporting/VocReportView';
import { VocUpload } from './VocUpload';
import { VocLookup } from './VocLookup';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Voice of the Customer — all offices (staff/admin). Admins can import the HD
 * export; everyone with reports access sees the office + rep breakdown, can
 * filter by date, and can check whether specific Lead #s have a completed VOC. */
export default async function StaffVocPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? '') ? searchParams.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? '') ? searchParams.to : undefined;
  const report = await loadVocReport({ from, to });
  const canUpload = user.role === 'ADMIN';

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">{t('staffReports.backAllReports')}</Link>
      <SectionHero eyebrow={t('voc.eyebrow')} title={t('voc.title')} subtitle={t('voc.subtitleAll')} />

      {canUpload && <VocUpload />}

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
        <Link href="/staff/reports/voc?from=2026-01-01&to=2026-06-30" className="btn-secondary text-sm">{t('voc.contestPreset')}</Link>
        {(from || to) && <Link href="/staff/reports/voc" className="btn-secondary text-sm">{t('voc.clearDates')}</Link>}
      </form>

      {report.lastImportedAt && (
        <p className="text-xs text-gray-400">
          {t('voc.lastImported')}: {report.lastImportedAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}{report.totalStored} {t('voc.vocsWord')} {t('voc.storedWord')}
        </p>
      )}

      <VocReportView report={report} />

      <VocLookup />
    </div>
  );
}
