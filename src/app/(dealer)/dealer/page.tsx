import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchBox } from '@/components/SearchBox';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { searchWhere } from '@/lib/search';
import { programLabel } from '@/lib/constants';

export default async function DealerHome({ searchParams }: { searchParams: { q?: string } }) {
  const user = await requireDealerAccess();
  const search = searchWhere(searchParams.q);
  const [apps, announcements] = await Promise.all([
    prisma.application.findMany({
      where: search ? { AND: [dealerPortalScopeWhere(user), search] } : dealerPortalScopeWhere(user),
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div>
      <AnnouncementBanner announcements={announcements} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Applications</h1>
        <div className="flex items-center gap-3">
          <SearchBox action="/dealer" q={searchParams.q} />
          <Link href="/dealer/applications/new" className="btn-primary">
            New customer processing
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          {searchParams.q ? `No applications match “${searchParams.q}”.` : 'No applications yet. Start by creating a new application.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Province</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dealer/applications/${a.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {a.applicantFirstName} {a.applicantLastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{a.province}</td>
                  <td className="px-4 py-3">{programLabel(a.programType, a.programCategory)}</td>
                  <td className="px-4 py-3">${a.requestedAmount.toString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {a.createdAt.toLocaleDateString('en-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
