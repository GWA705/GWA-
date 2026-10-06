import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { isAdmin } from '@/lib/rbac';
import { canViewReportsArea } from '@/lib/reporting/access';
import { reportDataset } from '@/lib/reporting/reportDataset';
import { journalUnitsByRep, repKey } from '@/lib/reporting/salespersonLeaderboard';
import { listReportOffices } from '@/lib/reporting/monthly';
import { SalesRepReport, type RepStat } from '@/components/reporting/SalesRepReport';
import { ReportHeader, ReportStamp, reportGeneratedLabel } from '@/components/reporting/kit';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const APPROVED: ApplicationStatus[] = ['CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const RANGES = [
  { key: 'all', label: 'All time' },
  { key: 'ytd', label: 'Year to date' },
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

/**
 * Admin-side Sales reps report — the owner Sales-rep breakdown for any single
 * office. Units sold come from the sales journal, which is per office, so an
 * office must be chosen (no all-offices aggregate here). Internal admins only.
 */
export default async function StaffSalesRepsPage({ searchParams }: { searchParams: { office?: string; range?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isAdmin(user) || !(await canViewReportsArea(user))) notFound();

  const offices = await listReportOffices();
  if (offices.length === 0) {
    return (
      <div className="space-y-5">
        <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>
        <p className="text-sm text-gray-500">No offices have any stores yet.</p>
      </div>
    );
  }
  const officeId = offices.some((o) => o.dealerId === searchParams.office) ? (searchParams.office as string) : offices[0].dealerId;
  const officeName = offices.find((o) => o.dealerId === officeId)?.name ?? '';
  const range = (RANGES.some((r) => r.key === searchParams.range) ? searchParams.range : '12m') as RangeKey;
  const rangeLabel = RANGES.find((r) => r.key === range)!.label;
  const cut = cutoffYm(range);

  const rows = (await reportDataset({ dealerIds: [officeId] })).filter(
    (r) => APPROVED.includes(r.statusRaw) && (!cut || r.ym >= cut),
  );

  const map = new Map<string, { count: number; total: number; programs: Map<string, number> }>();
  for (const r of rows) {
    const b = map.get(r.salesperson) ?? { count: 0, total: 0, programs: new Map() };
    b.count += 1;
    b.total += r.amount;
    b.programs.set(r.program, (b.programs.get(r.program) ?? 0) + 1);
    map.set(r.salesperson, b);
  }
  const unitsByRep = await journalUnitsByRep(officeId, cut);

  const reps: RepStat[] = [...map.entries()]
    .map(([name, b]) => ({
      name,
      count: b.count,
      total: b.total,
      units: unitsByRep.get(repKey(name)) ?? 0,
      avg: b.count ? b.total / b.count : 0,
      topProgram: [...b.programs.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? '—',
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="office">Office</label>
          <select id="office" name="office" defaultValue={officeId} className="input min-w-[200px]">
            {offices.map((o) => (
              <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="range">Range</label>
          <select id="range" name="range" defaultValue={range} className="input min-w-[160px]">
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary h-10">View</button>
      </form>

      <ReportHeader org={officeName} title="Sales reps" generated={`Generated ${reportGeneratedLabel()}`} />
      <SalesRepReport reps={reps} rangeLabel={rangeLabel} />
      <ReportStamp brand="Georgian Water & Air" generated={`Generated ${reportGeneratedLabel()}`} />
    </div>
  );
}
