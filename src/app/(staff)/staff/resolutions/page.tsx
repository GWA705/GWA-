import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { loadResolutionQueue } from '@/lib/resolutionCases';
import { RESOLUTION_STATUSES, STATUS_LABEL, statusChipClass } from '@/lib/resolutionStatus';

export const dynamic = 'force-dynamic';

const AGE_ROW: Record<string, string> = {
  red: 'bg-red-50/60 dark:bg-red-900/20',
  amber: 'bg-amber-50/60 dark:bg-amber-900/20',
  none: '',
};

export default async function ResolutionQueuePage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  await requireRole('REVIEWER', 'ADMIN');
  const queue = await loadResolutionQueue({ status: searchParams.status, q: searchParams.q });
  const active = queue.status;

  // Count chips (click to filter). "Live" = the default open-only view.
  const liveCount = (['OPEN', 'IN_PROGRESS', 'WAITING_ON_OFFICE', 'ESCALATED_HD'] as const).reduce((s, k) => s + queue.counts[k], 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">🧰 HD Resolution Centre</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">Home Depot resolution-centre problems, tracked to resolved. Open cases turn amber at 3 days, red at 7.</p>
        </div>
        <Link href="/staff/resolutions/new" className="btn-primary">＋ New case</Link>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip href="/staff/resolutions" label={`Live · ${liveCount}`} active={!active} />
        {RESOLUTION_STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={`/staff/resolutions?status=${s}`}
            label={`${STATUS_LABEL[s]} · ${queue.counts[s]}`}
            active={active === s}
          />
        ))}
        <FilterChip href="/staff/resolutions?status=all" label="All" active={active === 'all'} />
      </div>

      {/* Search */}
      <form method="GET" className="flex flex-wrap items-end gap-2">
        {active && <input type="hidden" name="status" value={active} />}
        <input name="q" defaultValue={queue.q} placeholder="Search case #, customer, HD ref…" className="input min-w-[220px]" />
        <button type="submit" className="btn-secondary">Search</button>
      </form>

      {/* Queue table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Office</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {queue.rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">No cases{queue.q || active ? ' match your filters' : ' yet'}.</td></tr>
              ) : (
                queue.rows.map((r) => (
                  <tr key={r.id} className={AGE_ROW[r.age]}>
                    <td className="px-4 py-3">
                      <Link href={`/staff/resolutions/${r.id}`} className="font-semibold text-brand-700 hover:underline dark:text-sky-300">{r.caseNumber}</Link>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{r.title}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-slate-200">{r.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{r.officeName}</td>
                    <td className="px-4 py-3">
                      <span className={statusChipClass(r.status)}>{STATUS_LABEL[r.status]}</span>
                      {r.age === 'red' && <span className="ml-2 text-xs font-semibold text-red-600">● aging</span>}
                      {r.age === 'amber' && <span className="ml-2 text-xs font-semibold text-amber-600">● ageing</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.openedDay}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300'
      }`}
    >
      {label}
    </Link>
  );
}
