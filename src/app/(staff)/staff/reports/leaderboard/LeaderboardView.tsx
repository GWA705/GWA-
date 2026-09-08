import type { SalespersonLeaderboard } from '@/lib/reporting/salespersonLeaderboard';
import { getT } from '@/i18n/server';

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

const RANK_STYLE = ['bg-[#F96302] text-white', 'bg-slate-400 text-white', 'bg-amber-700 text-white'];

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
        <div className="grid grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.reps')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.rows.length}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.paidDeals')}</div>
            <div className="text-3xl font-extrabold leading-none text-white">{report.totalDeals}</div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{t('leaderboard.volume')}</div>
            <div className="text-2xl font-extrabold leading-none text-white">{money(report.totalVolume)}</div>
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">{t('leaderboard.colRep')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colDeals')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colAvg')}</th>
                <th className="px-2 py-2 text-right font-medium">{t('leaderboard.colVolume')}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={r.name} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[i] ?? 'bg-gray-100 text-gray-600'}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-2 text-left font-semibold text-gray-900">{r.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.deals}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-800">{r.avgDeal > 0 ? money(r.avgDeal) : '—'}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-900">{money(r.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {report.unspecified > 0 && (
        <p className="text-xs text-gray-400">{t('leaderboard.unspecifiedNote', { n: report.unspecified })}</p>
      )}
      <p className="text-xs text-gray-400">{t('leaderboard.basisNote')}</p>
    </div>
  );
}
