import type { SalespersonLeaderboard } from '@/lib/reporting/salespersonLeaderboard';
import { getT } from '@/i18n/server';
import { LeaderboardTable } from './LeaderboardTable';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function LeaderboardView({ report }: { report: SalespersonLeaderboard }) {
  const t = getT();

  if (report.rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        {report.error ? t('leaderboard.readError', { error: report.error }) : t('leaderboard.noData')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI band */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2e44] via-[#22344f] to-[#0e2b5c] shadow-sm">
        <div className="grid grid-cols-2 divide-white/15 sm:grid-cols-4 sm:divide-x">
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.reps')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.rows.length}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.paidDeals')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.totalDeals}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.unitsSold')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.totalUnits > 0 ? report.totalUnits : '—'}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.volume')}</div>
            <div className="text-2xl font-extrabold leading-none text-white">{money(report.totalVolume)}</div>
          </div>
        </div>
      </div>

      {/* Leaderboard table (client — rows expand to show merged spellings) */}
      <LeaderboardTable rows={report.rows} />

      {report.unspecified > 0 && (
        <p className="text-xs text-gray-400">{t('leaderboard.unspecifiedNote', { n: report.unspecified })}</p>
      )}
      <p className="text-xs text-gray-400">{t('leaderboard.basisNote')}</p>
    </div>
  );
}
