import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/StatusBadge';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL'];
const FUNDING_STATUSES: ApplicationStatus[] = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW'];

export default async function StaffQueue({
  searchParams,
}: {
  searchParams: { tab?: string; status?: string };
}) {
  await requireRole('REVIEWER', 'ADMIN');
  const tab = searchParams.tab === 'funding' ? 'funding' : 'review';
  const baseStatuses = tab === 'funding' ? FUNDING_STATUSES : REVIEW_STATUSES;

  const statusFilter =
    searchParams.status && baseStatuses.includes(searchParams.status as ApplicationStatus)
      ? [searchParams.status as ApplicationStatus]
      : baseStatuses;

  const apps = await prisma.application.findMany({
    where: { status: { in: statusFilter } },
    orderBy: { createdAt: 'asc' },
    include: { dealer: true, _count: { select: { documents: true } } },
    take: 200,
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <TabLink current={tab} tab="review" label="Review queue" />
        <TabLink current={tab} tab="funding" label="Funding queue" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <FilterLink tab={tab} status={undefined} active={!searchParams.status} label="All" />
        {baseStatuses.map((s) => (
          <FilterLink key={s} tab={tab} status={s} active={searchParams.status === s} label={s} />
        ))}
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">Nothing in this queue.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">Province</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Docs</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/staff/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">
                      {a.applicantFirstName} {a.applicantLastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.dealer.name}</td>
                  <td className="px-4 py-3">{a.province}</td>
                  <td className="px-4 py-3">${a.requestedAmount.toString()}</td>
                  <td className="px-4 py-3 text-gray-500">{a._count.documents}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{a.createdAt.toLocaleDateString('en-CA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabLink({ current, tab, label }: { current: string; tab: string; label: string }) {
  const active = current === tab;
  return (
    <Link
      href={`/staff?tab=${tab}`}
      className={`border-b-2 px-1 pb-2 text-sm font-medium ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </Link>
  );
}

function FilterLink({
  tab,
  status,
  active,
  label,
}: {
  tab: string;
  status?: string;
  active: boolean;
  label: string;
}) {
  const href = status ? `/staff?tab=${tab}&status=${status}` : `/staff?tab=${tab}`;
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {label}
    </Link>
  );
}
