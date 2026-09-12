import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasDealerReportAccess } from '@/lib/reporting/access';
import { reportingJournalEnabled } from '@/lib/reporting/journalRead';
import { buildSalespersonLeaderboard } from '@/lib/reporting/salespersonLeaderboard';
import { LeaderboardView } from '@/app/(staff)/staff/reports/leaderboard/LeaderboardView';
import { DealerReportTabs } from '../DealerReportTabs';
import { ReportActions } from '../ReportActions';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Dealer "Salesperson leaderboard" — ranks the dealer's OWN team (reps for their
 * office) by paid volume, deals and units, from the sales journal. Printable and
 * emailable. */
export default async function DealerLeaderboardPage({ searchParams }: { searchParams: { year?: string } }) {
  const user = await requireDealerAccess();
  if (!(await hasDealerReportAccess(user)) || !user.dealerId) notFound();

  const t = getT();
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];
  const year = years.some((y) => String(y) === searchParams.year) ? parseInt(searchParams.year as string, 10) : thisYear;

  return (
    <div className="space-y-5">
      <DealerReportTabs active="leaderboard" />

      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="year">{t('financeReport.year')}</label>
            <select id="year" name="year" defaultValue={String(year)} className="input min-w-[120px]">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">{t('reports.view')}</button>
        </form>
        <ReportActions title={t('reports.tabLeaderboard')} />
      </div>

      {!reportingJournalEnabled() ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t('reports.notReady')}</div>
      ) : (
        <div className="print-sheet space-y-5">
          <LeaderboardView report={await buildSalespersonLeaderboard(user.dealerId, year)} />
        </div>
      )}
    </div>
  );
}
