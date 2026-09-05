import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { canViewOwnerPricingReport } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { SalesRepReport, type RepStat } from '@/components/reporting/SalesRepReport';
import { DealerReportTabs } from '../DealerReportTabs';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const APPROVED: ApplicationStatus[] = ['CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function cutoffYm(range: RangeKey): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'ytd') return `${now.getFullYear()}-01`;
  const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function DealerSalesRepReport({ searchParams }: { searchParams: { range?: string } }) {
  const user = await requireDealerAccess();
  if (!(await canViewOwnerPricingReport(user)) || !user.dealerId) notFound();

  const range = (RANGES.some((r) => r.key === searchParams.range) ? searchParams.range : '12m') as RangeKey;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  const cut = cutoffYm(range);

  const rows = (await reportDataset({ dealerIds: [user.dealerId] })).filter(
    (r) => APPROVED.includes(r.statusRaw) && (!cut || r.ym >= cut),
  );

  // Group by rep.
  const map = new Map<string, { count: number; total: number; programs: Map<string, number> }>();
  for (const r of rows) {
    const b = map.get(r.salesperson) ?? { count: 0, total: 0, programs: new Map() };
    b.count += 1;
    b.total += r.amount;
    b.programs.set(r.program, (b.programs.get(r.program) ?? 0) + 1);
    map.set(r.salesperson, b);
  }
  const reps: RepStat[] = [...map.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      total: v.total,
      avg: v.count ? v.total / v.count : 0,
      topProgram: [...v.programs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      <DealerReportTabs active="reps" showOwner />
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="range">Date range</label>
          <select id="range" name="range" defaultValue={range} className="input min-w-[180px]">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">View</button>
      </form>
      <SalesRepReport reps={reps} rangeLabel={rangeLabel} />
    </div>
  );
}
