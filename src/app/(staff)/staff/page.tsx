import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchBox } from '@/components/SearchBox';
import { searchWhere } from '@/lib/search';
import { programLabel } from '@/lib/constants';
import type { ApplicationStatus, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Filter groups shown in the queue menu. Every deal is reachable through one of
// these; "All" shows everything so nothing ever disappears from view.
const GROUPS: {
  key: string;
  label: string;
  statuses?: ApplicationStatus[];
  paid?: boolean;
}[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New', statuses: ['SUBMITTED', 'UNDER_REVIEW'] },
  { key: 'approved', label: 'Approved', statuses: ['APPROVED', 'CONDITIONAL'] },
  { key: 'funding', label: 'In for funding', statuses: ['FUNDING_SUBMITTED', 'FUNDING_REVIEW'] },
  { key: 'funded', label: 'Funded', statuses: ['FUNDED'] },
  { key: 'paid', label: 'Paid', paid: true },
  { key: 'problem', label: 'Problem', statuses: ['PROBLEM'] },
  { key: 'declined', label: 'Declined', statuses: ['DECLINED', 'WITHDRAWN'] },
];

// Priority ordering: new/incoming work first, completed work last.
const RANK: Record<ApplicationStatus, number> = {
  PROBLEM: 0,
  SUBMITTED: 1,
  FUNDING_SUBMITTED: 2,
  UNDER_REVIEW: 3,
  FUNDING_REVIEW: 4,
  CONDITIONAL: 5,
  APPROVED: 6,
  FUNDED: 7,
  DECLINED: 8,
  WITHDRAWN: 9,
  DRAFT: 10,
};

function whereFor(key: string): Prisma.ApplicationWhereInput {
  const group = GROUPS.find((g) => g.key === key) ?? GROUPS[0];
  if (group.paid) return { payouts: { some: {} } };
  if (group.statuses) return { status: { in: group.statuses } };
  return {};
}

function daysAgo(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default async function StaffQueue({
  searchParams,
}: {
  searchParams: { filter?: string; q?: string };
}) {
  await requireRole('REVIEWER', 'ADMIN');
  const active = GROUPS.find((g) => g.key === searchParams.filter) ? searchParams.filter! : 'all';
  const search = searchWhere(searchParams.q);
  // A search looks across every deal (ignores the status filter).
  const listWhere = search ?? whereFor(active);

  const [apps, statusCounts, paidCount] = await Promise.all([
    prisma.application.findMany({
      where: listWhere,
      include: { dealer: true, _count: { select: { documents: true, payouts: true } } },
      take: 300,
    }),
    prisma.application.groupBy({ by: ['status'], _count: true }),
    prisma.application.count({ where: { payouts: { some: {} } } }),
  ]);

  // Priority sort: rank asc, then oldest first (longest waiting = more urgent).
  apps.sort((a, b) => RANK[a.status] - RANK[b.status] || a.createdAt.getTime() - b.createdAt.getTime());

  const countByStatus = (s: ApplicationStatus) =>
    statusCounts.find((c) => c.status === s)?._count ?? 0;
  const groupCount = (g: (typeof GROUPS)[number]) => {
    if (g.key === 'all') return statusCounts.reduce((n, c) => n + c._count, 0);
    if (g.paid) return paidCount;
    return (g.statuses ?? []).reduce((n, s) => n + countByStatus(s), 0);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
        <SearchBox action="/staff" q={searchParams.q} />
      </div>

      {searchParams.q ? (
        <p className="mb-4 text-sm text-gray-500">
          Search results for “{searchParams.q}” — {apps.length} match(es).{' '}
          <Link href="/staff" className="text-brand-700 hover:underline">Back to all deals</Link>
        </p>
      ) : null}

      {/* Status filter menu */}
      <div className={`mb-5 flex flex-wrap gap-2 ${searchParams.q ? 'hidden' : ''}`}>
        {GROUPS.map((g) => {
          const isActive = active === g.key;
          const count = groupCount(g);
          return (
            <Link
              key={g.key}
              href={g.key === 'all' ? '/staff' : `/staff?filter=${g.key}`}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                isActive ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
              }`}
            >
              {g.label}
              <span className={`rounded-full px-1.5 text-xs ${isActive ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No deals in this view.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Waiting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => {
                const isNew = a.status === 'SUBMITTED' || a.status === 'FUNDING_SUBMITTED';
                const age = daysAgo(a.createdAt);
                return (
                  <tr key={a.id} className={isNew ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isNew && <span className="h-2 w-2 flex-none rounded-full bg-blue-500" title="Needs attention" />}
                        <Link href={`/staff/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">
                          {a.applicantFirstName} {a.applicantLastName}
                        </Link>
                        {a._count.payouts > 0 && (
                          <span className="badge bg-emerald-100 text-emerald-800">Paid</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.dealer.name}</td>
                    <td className="px-4 py-3">{programLabel(a.programType, a.programCategory)}</td>
                    <td className="px-4 py-3 tabular-nums">${a.requestedAmount.toString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-gray-500">{age === 0 ? 'today' : `${age}d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
