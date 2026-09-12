import Link from 'next/link';
import { getT } from '@/i18n/server';
import { formatDuration, type CycleTimesResult, type TaskStat } from '@/lib/reporting/cycleTimes';
import { reportTheadRow } from '@/components/reporting/kit';

export type RangeKey = '30' | '90' | '365' | 'all';
export const RANGE_OPTIONS: { key: RangeKey }[] = [
  { key: '30' },
  { key: '90' },
  { key: '365' },
  { key: 'all' },
];

const RANGE_LABEL_KEY: Record<RangeKey, string> = {
  '30': 'cycleTimes.range30',
  '90': 'cycleTimes.range90',
  '365': 'cycleTimes.range365',
  all: 'cycleTimes.rangeAll',
};

const KIND_BADGE: Record<TaskStat['kind'], { labelKey: string; cls: string }> = {
  reviewer: { labelKey: 'cycleTimes.badgeReviewer', cls: 'bg-brand-50 text-brand-700' },
  dealer: { labelKey: 'cycleTimes.badgeDealer', cls: 'bg-amber-100 text-amber-800' },
  total: { labelKey: 'cycleTimes.badgeTotal', cls: 'bg-gray-200 text-gray-700' },
};

export function CycleTimesView({ result, range }: { result: CycleTimesResult; range: RangeKey }) {
  const t = getT();
  const { tasks, dealsConsidered } = result;
  // The slowest reviewer-owned step (by median) — the obvious place to improve.
  const reviewerTasks = tasks.filter((t) => t.kind === 'reviewer' && t.medianMs !== null);
  const slowest = reviewerTasks.reduce<TaskStat | null>((max, t) => (max === null || (t.medianMs ?? 0) > (max.medianMs ?? 0) ? t : max), null);

  const dealsNoun = dealsConsidered === 1 ? t('cycleTimes.dealOne') : t('cycleTimes.dealMany');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← {t('cycleTimes.backReports')}</Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{t('cycleTimes.heading')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t('cycleTimes.intro1')} <strong>{t('cycleTimes.introSubmitted')}</strong>{' '}
            {t('cycleTimes.introWindow', { n: dealsConsidered, noun: dealsNoun })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1">
          {RANGE_OPTIONS.map((o) => (
            <Link
              key={o.key}
              href={`/staff/reports/cycle-times?days=${o.key}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                o.key === range ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t(RANGE_LABEL_KEY[o.key])}
            </Link>
          ))}
        </div>
      </div>

      {slowest && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          <span className="font-semibold">{t('cycleTimes.biggestWait')}</span> {slowest.label} — {t('cycleTimes.median')}{' '}
          <strong>{formatDuration(slowest.medianMs)}</strong>{' '}
          {t('cycleTimes.acrossDeals', { n: slowest.count, noun: slowest.count === 1 ? t('cycleTimes.dealOne') : t('cycleTimes.dealMany') })}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={reportTheadRow}>
              <th className="px-4 py-3 font-semibold">{t('cycleTimes.colTask')}</th>
              <th className="px-4 py-3 font-semibold">{t('cycleTimes.colOwner')}</th>
              <th className="px-4 py-3 text-right font-semibold">{t('cycleTimes.colDeals')}</th>
              <th className="px-4 py-3 text-right font-semibold">{t('cycleTimes.colMedian')}</th>
              <th className="px-4 py-3 text-right font-semibold">{t('cycleTimes.colAverage')}</th>
              <th className="px-4 py-3 text-right font-semibold">{t('cycleTimes.colP90')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const badge = KIND_BADGE[task.kind];
              const isTotal = task.kind === 'total';
              return (
                <tr key={task.key} className={`border-b border-gray-100 last:border-0 ${isTotal ? 'bg-gray-50/60 font-medium' : ''}`}>
                  <td className="px-4 py-3 text-gray-800">{task.label}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>{t(badge.labelKey)}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{task.count || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{formatDuration(task.medianMs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatDuration(task.avgMs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatDuration(task.p90Ms)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        <p>
          <strong className="text-gray-500">{t('cycleTimes.ownerLabel')}</strong>{' '}
          <span className="text-brand-700">{t('cycleTimes.ownerGwa')}</span> {t('cycleTimes.ownerGwaDesc')} ·{' '}
          <span className="text-amber-700">{t('cycleTimes.ownerDealer')}</span> {t('cycleTimes.ownerDealerDesc')} ·{' '}
          <span className="text-gray-600">{t('cycleTimes.ownerTotal')}</span> {t('cycleTimes.ownerTotalDesc')}
        </p>
        <p>{t('cycleTimes.note')}</p>
      </div>
    </div>
  );
}
