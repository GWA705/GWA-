import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { listReportOffices } from '@/lib/reporting/monthly';
import { buildSalespersonLeaderboard } from '@/lib/reporting/salespersonLeaderboard';
import { LeaderboardView } from './LeaderboardView';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { office?: string; year?: string };
}) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();

  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];
  const year = years.some((y) => String(y) === searchParams.year) ? parseInt(searchParams.year as string, 10) : thisYear;

  const officeId = offices.some((o) => o.dealerId === searchParams.office)
    ? (searchParams.office as string)
    : offices[0]?.dealerId;

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">
        {t('staffReports.backAllReports')}
      </Link>

      <SectionHero
        eyebrow={t('leaderboard.eyebrow')}
        title={t('leaderboard.title')}
        subtitle={t('leaderboard.subtitle')}
      />

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">{t('staffReports.office')}</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {offices.length === 0 && <option value="">{t('staffReports.noOfficesWithStores')}</option>}
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="year">{t('financeReport.year')}</label>
          <select id="year" name="year" defaultValue={String(year)} className="input min-w-[120px]">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">{t('reports.view')}</button>
      </form>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t('staffReports.journalNotConnected1')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2026</code>
          {t('staffReports.journalNotConnected2')}<code className="rounded bg-amber-100 px-1">JOURNAL_SHEET_ID_2025</code>{t('staffReports.journalNotConnected3')}
        </div>
      ) : !officeId ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          {t('staffReports.noOfficeStoresAssigned')}
        </div>
      ) : (
        <LeaderboardView report={await buildSalespersonLeaderboard(officeId, year)} />
      )}
    </div>
  );
}
