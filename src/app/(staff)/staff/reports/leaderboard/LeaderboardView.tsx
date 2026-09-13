import type { SalespersonLeaderboard } from '@/lib/reporting/salespersonLeaderboard';
import { getT } from '@/i18n/server';
import { LeaderboardTable } from './LeaderboardTable';
import { ReportHeader, ReportTile, ReportTiles, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function LeaderboardView({ report, org, orgLogoUrl }: { report: SalespersonLeaderboard; org?: string; orgLogoUrl?: string | null }) {
  const t = getT();
  const scope = `${report.office?.name ?? t('staffReports.allOffices')} · ${report.year}`;

  if (report.rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {report.error ? t('leaderboard.readError', { error: report.error }) : t('leaderboard.noData')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        org={org}
        logoUrl={orgLogoUrl}
        title={t('reports.tabLeaderboard')}
        scope={scope}
        generated={t('reportStamp.generated', { date: reportGeneratedLabel() })}
      />

      <ReportTiles cols={4}>
        <ReportTile label={t('leaderboard.reps')} value={report.rows.length} />
        <ReportTile label={t('leaderboard.paidDeals')} value={report.totalDeals} />
        <ReportTile label={t('leaderboard.unitsSold')} value={report.totalUnits > 0 ? report.totalUnits : '—'} />
        <ReportTile label={t('leaderboard.volume')} value={money(report.totalVolume)} />
      </ReportTiles>

      {/* Leaderboard table (client — rows expand to show merged spellings) */}
      <LeaderboardTable rows={report.rows} />

      {report.unspecified > 0 && (
        <p className="text-xs text-gray-400">{t('leaderboard.unspecifiedNote', { n: report.unspecified })}</p>
      )}
      <p className="text-xs text-gray-400">{t('leaderboard.basisNote')}</p>

      <ReportStamp brand={t('reportStamp.brand')} generated={t('reportStamp.generated', { date: reportGeneratedLabel() })} />
    </div>
  );
}
