import Link from 'next/link';
import { formatDuration, type CycleTimesResult, type TaskStat } from '@/lib/reporting/cycleTimes';

export type RangeKey = '30' | '90' | '365' | 'all';
export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: '365', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
];

const KIND_BADGE: Record<TaskStat['kind'], { label: string; cls: string }> = {
  reviewer: { label: 'GWA', cls: 'bg-brand-50 text-brand-700' },
  dealer: { label: 'Dealer', cls: 'bg-amber-100 text-amber-800' },
  total: { label: 'Total', cls: 'bg-gray-200 text-gray-700' },
};

export function CycleTimesView({ result, range }: { result: CycleTimesResult; range: RangeKey }) {
  const { tasks, dealsConsidered } = result;
  // The slowest reviewer-owned step (by median) — the obvious place to improve.
  const reviewerTasks = tasks.filter((t) => t.kind === 'reviewer' && t.medianMs !== null);
  const slowest = reviewerTasks.reduce<TaskStat | null>((max, t) => (max === null || (t.medianMs ?? 0) > (max.medianMs ?? 0) ? t : max), null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← Reports</Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">Review cycle times</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            How long deals spend between each milestone, to spot where time goes and track improvements. Measured
            from the status history across deals <strong>submitted</strong> in the window ({dealsConsidered} deal
            {dealsConsidered === 1 ? '' : 's'}).
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
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {slowest && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          <span className="font-semibold">Biggest GWA-side wait:</span> {slowest.label} — median{' '}
          <strong>{formatDuration(slowest.medianMs)}</strong> across {slowest.count} deal{slowest.count === 1 ? '' : 's'}.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 text-right font-semibold">Deals</th>
              <th className="px-4 py-3 text-right font-semibold">Median</th>
              <th className="px-4 py-3 text-right font-semibold">Average</th>
              <th className="px-4 py-3 text-right font-semibold">90th %</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const badge = KIND_BADGE[t.kind];
              const isTotal = t.kind === 'total';
              return (
                <tr key={t.key} className={`border-b border-gray-100 last:border-0 ${isTotal ? 'bg-gray-50/60 font-medium' : ''}`}>
                  <td className="px-4 py-3 text-gray-800">{t.label}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{t.count || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{formatDuration(t.medianMs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatDuration(t.avgMs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatDuration(t.p90Ms)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        <p><strong className="text-gray-500">Owner:</strong> <span className="text-brand-700">GWA</span> = a step your team controls · <span className="text-amber-700">Dealer</span> = waiting on the dealer · <span className="text-gray-600">Total</span> = end-to-end.</p>
        <p>Median is the typical case; the 90th percentile is the slow tail. Recent-window rows for later stages have fewer deals because newer deals haven&apos;t reached them yet — always read the count.</p>
      </div>
    </div>
  );
}
