import { ReportTile, ReportTiles, reportTheadRow } from './kit';
import type { VocReport } from '@/lib/reporting/voc';
import { getT } from '@/i18n/server';

/**
 * Renders the VOC breakdown: KPI tiles, then a per-office section with a
 * sales-rep table. Used by both the dealer view (one office, `singleOffice`) and
 * the staff/admin view (all offices). Presentational — all data is prepared by
 * loadVocReport().
 */
export function VocReportView({ report, singleOffice = false }: { report: VocReport; singleOffice?: boolean }) {
  const t = getT();
  const realOffices = report.offices.filter((o) => o.dealerId);
  const unmatchedTotal = report.totalVocs - report.matchedToRep;

  if (report.count === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">{t('voc.noData')}</div>
    );
  }

  return (
    <div className="space-y-5">
      <ReportTiles cols={singleOffice ? 3 : 4}>
        <ReportTile label={t('voc.tileCompleted')} value={report.totalVocs.toLocaleString('en-CA')} />
        <ReportTile label={t('voc.tileMatched')} value={`${report.matchedToRep} · ${report.matchRatePct}%`} />
        <ReportTile label={t('voc.tileUnmatched')} value={unmatchedTotal.toLocaleString('en-CA')} />
        {!singleOffice && <ReportTile label={t('voc.tileOffices')} value={String(realOffices.length)} />}
      </ReportTiles>

      {!report.configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{t('voc.journalOff')}</div>
      )}

      {(() => {
        const leaders = report.offices
          .flatMap((o) => o.reps.filter((r) => r.matched).map((r) => ({ rep: r.rep, office: o.office, count: r.count })))
          .sort((a, b) => b.count - a.count || a.rep.localeCompare(b.rep));
        if (leaders.length === 0) return null;
        const medal = ['🥇', '🥈', '🥉'];
        return (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h3 className="text-base font-bold text-gray-900">{t('voc.leaderboardTitle')}</h3>
              <p className="text-xs text-gray-500">{t('voc.leaderboardHint')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={reportTheadRow}>
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">{t('voc.colRep')}</th>
                    {!singleOffice && <th className="px-4 py-3">{t('voc.colOffice')}</th>}
                    <th className="px-4 py-3 text-right">{t('voc.colCount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaders.map((l, i) => (
                    <tr key={i} className={i % 2 ? 'bg-gray-50/40' : ''}>
                      <td className="px-4 py-2.5 tabular-nums text-gray-500">{medal[i] ?? i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{l.rep}</td>
                      {!singleOffice && <td className="px-4 py-2.5 text-gray-600">{l.office}</td>}
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{l.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {report.offices.map((office) => (
        <section key={office.dealerId ?? office.office} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-3">
            <h3 className="text-base font-bold text-gray-900">{office.office}</h3>
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{office.total}</span> {t('voc.vocsWord')}
              {office.avgOverall != null && <> · {t('voc.avg')} {office.avgOverall.toFixed(2)}</>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={reportTheadRow}>
                  <th className="px-4 py-3">{t('voc.colRep')}</th>
                  <th className="px-4 py-3 text-right">{t('voc.colCount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {office.reps.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-gray-50/40' : ''}>
                    <td className={`px-4 py-2.5 ${r.matched ? 'font-medium text-gray-800' : 'italic text-gray-400'}`}>
                      {r.matched ? r.rep : t('voc.repUnknown')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">
        {t('voc.matchRateNote', { matched: String(report.matchedToRep), total: String(report.totalVocs), pct: String(report.matchRatePct) })}
      </p>
    </div>
  );
}
