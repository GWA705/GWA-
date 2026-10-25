import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewReportsArea } from '@/lib/reporting/access';
import { buildConfirmationTeamStats } from '@/lib/reporting/confirmationStats';
import { SectionHero } from '@/components/SectionHero';

export const dynamic = 'force-dynamic';

type RangeKey = 'month' | 'lastmonth' | '30d' | 'year';
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
];

function rangeFor(key: RangeKey): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = now;
  if (key === '30d') return { start: new Date(now.getTime() - 30 * 86400000), end, label: 'the last 30 days' };
  if (key === 'year') return { start: new Date(now.getFullYear(), 0, 1), end, label: `${now.getFullYear()}` };
  if (key === 'lastmonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end: lmEnd, label: start.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end, label: now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) };
}

export default async function ConfirmationTeamReportPage({ searchParams }: { searchParams: { range?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewReportsArea(user))) notFound();
  if (user.role !== 'ADMIN') notFound(); // admin-level view

  const rangeKey = (RANGES.some((r) => r.key === searchParams.range) ? searchParams.range : 'month') as RangeKey;
  const { start, end, label } = rangeFor(rangeKey);
  const stats = await buildConfirmationTeamStats(start, end);

  const COLS: { key: keyof typeof stats.totals; label: string; hint?: string }[] = [
    { key: 'dealsConfirmed', label: 'Confirmed' },
    { key: 'issues', label: 'Issues' },
    { key: 'callAttempts', label: 'Call attempts' },
    { key: 'reached', label: 'Reached' },
    { key: 'callsLogged', label: 'Calls logged' },
    { key: 'reviewTotal', label: 'Review reqs' },
  ];

  return (
    <div className="space-y-6">
      <SectionHero eyebrow="Operations" title="Confirmation team" subtitle={`Activity per person for ${label}.`} />

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/staff/reports/confirmation-team?range=${r.key}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${r.key === rangeKey ? 'bg-[#0e2b5c] text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Team member</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-right">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.rows.length === 0 ? (
                <tr><td colSpan={COLS.length + 1} className="px-4 py-8 text-center text-gray-500">No confirmation activity in {label}.</td></tr>
              ) : (
                stats.rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.dealsConfirmed}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.issues || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.callAttempts || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.reached || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.callsLogged || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.reviewTotal || '—'}
                      {r.reviewTotal ? <span className="ml-1 text-xs text-gray-400">({r.reviewEmail}e/{r.reviewText}t)</span> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {stats.rows.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-700">Team total</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-right tabular-nums">{stats.totals[c.key]}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Confirmed / Issues come from who handled the confirmation; call attempts, reached and calls
        logged from who logged them; review requests from who sent them (e = email, t = text). Hours
        aren&rsquo;t tracked in the portal.
      </p>
    </div>
  );
}
