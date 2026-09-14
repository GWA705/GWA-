import Link from 'next/link';

/**
 * Period picker for the Leads report: All time / Weekly / Monthly, with prev/next
 * navigation. Plain links (no client state) so it works on the server-rendered
 * report and is `no-print` friendly. `basePath` is the report's route.
 */
export function LeadsPeriodControls({
  basePath,
  period,
  offset,
}: {
  basePath: string;
  period: 'all' | 'week' | 'month';
  offset: number;
}) {
  const href = (p: string, o = 0) => (p === 'all' ? basePath : `${basePath}?p=${p}&o=${o}`);
  const tab = (p: 'all' | 'week' | 'month', label: string) => (
    <Link
      href={href(p, 0)}
      className={`rounded-md px-3 py-1 font-semibold ${period === p ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
        {tab('all', 'All time')}
        {tab('week', 'Weekly')}
        {tab('month', 'Monthly')}
      </div>
      {period !== 'all' && (
        <>
          <Link href={href(period, offset - 1)} className="btn-secondary text-sm">←</Link>
          {offset < 0 && <Link href={href(period, offset + 1)} className="btn-secondary text-sm">→</Link>}
        </>
      )}
    </div>
  );
}
