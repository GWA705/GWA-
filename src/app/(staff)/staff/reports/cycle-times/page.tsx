import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { computeCycleTimes } from '@/lib/reporting/cycleTimes';
import { CycleTimesView, RANGE_OPTIONS, type RangeKey } from '../CycleTimesView';

export const dynamic = 'force-dynamic';

export default async function CycleTimesReportPage({ searchParams }: { searchParams: { days?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();

  const range: RangeKey = (RANGE_OPTIONS.some((o) => o.key === searchParams.days) ? searchParams.days : '90') as RangeKey;
  const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000);

  const result = await computeCycleTimes(since);

  return <CycleTimesView result={result} range={range} />;
}
