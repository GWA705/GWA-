import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchBox } from '@/components/SearchBox';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { searchWhere } from '@/lib/search';
import { programLabel } from '@/lib/constants';
import { dealerOutstanding } from '@/lib/outstanding';
import { getBannerRotation } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const PAGE_SIZES = [10, 25, 50, 100];

export default async function DealerHome({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; perPage?: string };
}) {
  const user = await requireDealerAccess();
  const search = searchWhere(searchParams.q);
  const where = search ? { AND: [dealerPortalScopeWhere(user), search] } : dealerPortalScopeWhere(user);

  const perPage = PAGE_SIZES.includes(Number(searchParams.perPage)) ? Number(searchParams.perPage) : 10;
  const total = await prisma.application.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), pageCount);

  const [apps, announcements] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        documents: { where: { stage: 'FUNDING' }, select: { type: true, verifiedAt: true } },
        serialNumbers: { select: { productLabel: true, value: true } },
        financeCompany: { select: { requiresSerialPerProduct: true } },
      },
    }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  const topBanners = announcements.filter((a) => a.position !== 'BOTTOM');
  const bottomBanners = announcements.filter((a) => a.position === 'BOTTOM');
  const rotation = await getBannerRotation();

  // Build a dashboard URL preserving the search query.
  const q = searchParams.q;
  const url = (params: { page?: number; perPage?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    sp.set('perPage', String(params.perPage ?? perPage));
    sp.set('page', String(params.page ?? page));
    return `/dealer?${sp.toString()}`;
  };

  const firstShown = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastShown = Math.min(page * perPage, total);

  return (
    <div>
      <AnnouncementBanner announcements={topBanners} rotate={rotation.top} />

      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Applications</h1>
          <Link href="/dealer/applications/new" className="btn-primary whitespace-nowrap text-sm">
            New customer processing
          </Link>
        </div>
        <SearchBox action="/dealer" q={searchParams.q} />
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          {searchParams.q ? `No applications match “${searchParams.q}”.` : 'No customers yet — start by clicking “New customer processing”.'}
        </div>
      ) : (
        <>
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
                {apps.map((a) => {
                  const outstanding = dealerOutstanding({
                    status: a.status,
                    productsSold: a.productsSold,
                    requiresSerials: !!a.financeCompany?.requiresSerialPerProduct && a.productsSold.length > 0,
                    serialNumbers: a.serialNumbers,
                    fundingDocs: a.documents,
                  });
                  return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dealer/applications/${a.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {a.applicantFirstName} {a.applicantLastName}
                        </Link>
                        {outstanding.hasAction && (
                          <span className={`badge ${outstanding.readyToSubmit ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                            {outstanding.readyToSubmit ? 'Ready to submit' : 'Action needed'}
                          </span>
                        )}
                      </div>
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination — 10 per page by default; expand or page through. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>Show</span>
              {PAGE_SIZES.map((n) => (
                <Link
                  key={n}
                  href={url({ perPage: n, page: 1 })}
                  className={`rounded px-2 py-1 ${n === perPage ? 'bg-brand-100 font-semibold text-brand-800' : 'hover:bg-gray-100'}`}
                >
                  {n}
                </Link>
              ))}
              <span>per page</span>
            </div>
            <div className="flex items-center gap-3">
              <span>{firstShown}–{lastShown} of {total}</span>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link href={url({ page: page - 1 })} className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">← Prev</Link>
                  ) : (
                    <span className="rounded border border-gray-100 px-2 py-1 text-gray-300">← Prev</span>
                  )}
                  <span>Page {page} of {pageCount}</span>
                  {page < pageCount ? (
                    <Link href={url({ page: page + 1 })} className="rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">Next →</Link>
                  ) : (
                    <span className="rounded border border-gray-100 px-2 py-1 text-gray-300">Next →</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {bottomBanners.length > 0 && (
        <div className="mt-6">
          <AnnouncementBanner announcements={bottomBanners} rotate={rotation.bottom} />
        </div>
      )}
    </div>
  );
}
