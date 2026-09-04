import Link from 'next/link';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { dealerPortalScopeWhere } from '@/lib/rbac';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchBox } from '@/components/SearchBox';
import { PinButton } from '@/components/PinButton';
import { DealerListControls } from '@/components/DealerListControls';
import { DEALER_SORTS } from '@/lib/sortOptions';
import { searchWhere } from '@/lib/search';
import { programLabel, STATUS_LABELS } from '@/lib/constants';
import { dealerOutstanding } from '@/lib/outstanding';
import { PageHeader } from '@/components/PageHeader';
import { NeedsAttention, type AttentionItem } from '@/components/dashboard/NeedsAttention';
import type { ApplicationStatus, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const BASE = '/dealer/applications';
const PAGE_SIZES = [10, 25, 50, 100];

// Statuses a dealer can filter by (all the ones their own deals move through).
const FILTER_STATUSES: ApplicationStatus[] = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL', 'APPROVED', 'DOCS_SENT',
  'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED', 'PROBLEM', 'DECLINED', 'WITHDRAWN',
];

function sortOrderBy(sort: string): Prisma.ApplicationOrderByWithRelationInput | Prisma.ApplicationOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest': return { createdAt: 'asc' };
    case 'amount_high': return { requestedAmount: 'desc' };
    case 'amount_low': return { requestedAmount: 'asc' };
    case 'name': return [{ applicantLastName: 'asc' }, { applicantFirstName: 'asc' }];
    case 'status': return { status: 'asc' };
    default: return { createdAt: 'desc' };
  }
}

export default async function DealerApplications({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; perPage?: string; status?: string; sort?: string };
}) {
  const user = await requireDealerAccess();
  const search = searchWhere(searchParams.q);
  const statusFilter = FILTER_STATUSES.includes(searchParams.status as ApplicationStatus)
    ? (searchParams.status as ApplicationStatus)
    : '';
  const sort = DEALER_SORTS.some((s) => s.value === searchParams.sort) ? searchParams.sort! : 'newest';
  const orderBy = sortOrderBy(sort);

  const filters: Prisma.ApplicationWhereInput[] = [dealerPortalScopeWhere(user)];
  if (search) filters.push(search);
  if (statusFilter) filters.push({ status: statusFilter });
  const baseWhere: Prisma.ApplicationWhereInput = { AND: filters };

  // This user's pinned deals — they float to the top of page 1 and are kept out
  // of the normal paginated list so they never appear twice.
  let pinnedIds: string[] = [];
  try {
    const pinRows = await prisma.applicationPin.findMany({
      where: { userId: user.userId },
      select: { applicationId: true },
    });
    pinnedIds = pinRows.map((r) => r.applicationId);
  } catch {
    pinnedIds = [];
  }
  const listWhere: Prisma.ApplicationWhereInput = pinnedIds.length
    ? { AND: [baseWhere, { id: { notIn: pinnedIds } }] }
    : baseWhere;

  const perPage = PAGE_SIZES.includes(Number(searchParams.perPage)) ? Number(searchParams.perPage) : 10;
  const total = await prisma.application.count({ where: listWhere });
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), pageCount);

  const listInclude = {
    documents: { where: { stage: 'FUNDING' as const }, select: { type: true, verifiedAt: true } },
    serialNumbers: { select: { productLabel: true, value: true } },
    financeCompany: { select: { requiresSerialPerProduct: true } },
  };

  const [listApps, pinnedApps] = await Promise.all([
    prisma.application.findMany({
      where: listWhere,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: listInclude,
    }),
    page === 1 && pinnedIds.length
      ? prisma.application.findMany({
          where: { AND: [baseWhere, { id: { in: pinnedIds } }] },
          orderBy: { createdAt: 'desc' },
          include: listInclude,
        })
      : Promise.resolve([]),
  ]);

  const pinnedSet = new Set(pinnedIds);
  const apps = [...pinnedApps, ...listApps];

  // Build a list URL preserving the search query, status filter and sort.
  const q = searchParams.q;
  const url = (params: { page?: number; perPage?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (statusFilter) sp.set('status', statusFilter);
    if (sort !== 'newest') sp.set('sort', sort);
    sp.set('perPage', String(params.perPage ?? perPage));
    sp.set('page', String(params.page ?? page));
    return `${BASE}?${sp.toString()}`;
  };

  const firstShown = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastShown = Math.min(page * perPage, total);

  // "Needs your attention" — deals to action across all of this dealer's deals
  // (independent of the current search/filter/page). Reviewer send-backs
  // (PROBLEM) first, flagged red.
  const attentionApps = await prisma.application.findMany({
    where: { AND: [dealerPortalScopeWhere(user), { status: { in: ['PROBLEM', 'APPROVED', 'CONDITIONAL', 'DOCS_SENT'] } }] },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, applicantFirstName: true, applicantLastName: true },
    take: 20,
  });
  const attention: AttentionItem[] = attentionApps
    .sort((a, b) => (b.status === 'PROBLEM' ? 1 : 0) - (a.status === 'PROBLEM' ? 1 : 0))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
      status: a.status,
      problem: a.status === 'PROBLEM',
    }));

  return (
    <div>
      <div className="mb-4 space-y-2.5">
        <PageHeader
          variant="rail"
          eyebrow="Deals"
          title="Applications"
          right={
            <Link href="/dealer/applications/new" className="btn-primary whitespace-nowrap text-sm">
              New customer processing
            </Link>
          }
        />
        {/* Search + filters share one row on desktop; stack on mobile. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox action={BASE} q={searchParams.q} />
          <DealerListControls
            basePath={BASE}
            status={statusFilter}
            sort={sort}
            statuses={FILTER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </div>
      </div>

      {attention.length > 0 && (
        <div className="mb-4">
          <NeedsAttention items={attention} />
        </div>
      )}

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">
          {searchParams.q || statusFilter ? 'No applications match your search or filter.' : 'No customers yet — start by clicking “New customer processing”.'}
        </div>
      ) : (
        <>
          {/* Mobile: a stacked card per application. The full table appears from sm up. */}
          <ul className="space-y-3 sm:hidden">
            {apps.map((a) => {
              const outstanding = dealerOutstanding({
                status: a.status,
                programType: a.programType,
                paymentMethod: a.paymentMethod,
                isSplitPayment: a.isSplitPayment,
                productsSold: a.productsSold,
                requiresSerials: !!a.financeCompany?.requiresSerialPerProduct && a.productsSold.length > 0,
                serialNumbers: a.serialNumbers,
                fundingDocs: a.documents,
              });
              const pinned = pinnedSet.has(a.id);
              return (
                <li key={a.id} className="relative">
                  <Link href={`/dealer/applications/${a.id}`} className={`card block p-4 pr-12 hover:bg-gray-50 ${pinned ? 'ring-1 ring-brand-200' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-brand-700">
                        {a.applicantFirstName} {a.applicantLastName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <StatusBadge status={a.status} short />
                        <span>{programLabel(a.programType, a.programCategory)} · ${a.requestedAmount.toString()}</span>
                      </div>
                    </div>
                    {outstanding.hasAction && (
                      <span
                        className={`mt-2 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          outstanding.readyToSubmit ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {outstanding.readyToSubmit ? '✓ Ready to submit' : '⚠ Action needed'}
                      </span>
                    )}
                  </Link>
                  <div className="absolute right-2 top-2">
                    <PinButton applicationId={a.id} pinned={pinned} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="card hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-3 sm:px-4">Applicant</th>
                  <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Province</th>
                  <th className="px-3 py-3 sm:px-4">Program</th>
                  <th className="px-3 py-3 sm:px-4">Amount</th>
                  <th className="px-3 py-3 sm:px-4">Status</th>
                  <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apps.map((a) => {
                  const outstanding = dealerOutstanding({
                    status: a.status,
                    programType: a.programType,
                    paymentMethod: a.paymentMethod,
                    isSplitPayment: a.isSplitPayment,
                    productsSold: a.productsSold,
                    requiresSerials: !!a.financeCompany?.requiresSerialPerProduct && a.productsSold.length > 0,
                    serialNumbers: a.serialNumbers,
                    fundingDocs: a.documents,
                  });
                  const pinned = pinnedSet.has(a.id);
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50 ${pinned ? 'bg-brand-50/40' : ''}`}>
                      <td className="px-3 py-3 sm:px-4">
                        <div className="flex items-start gap-1.5">
                          <PinButton applicationId={a.id} pinned={pinned} />
                          <div className="min-w-0">
                            <Link
                              href={`/dealer/applications/${a.id}`}
                              className="block font-medium text-brand-700 hover:underline"
                            >
                              {a.applicantFirstName} {a.applicantLastName}
                            </Link>
                            {outstanding.hasAction && (
                              <span
                                className={`mt-1 inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  outstanding.readyToSubmit ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {outstanding.readyToSubmit ? '✓ Ready to submit' : '⚠ Action needed'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 sm:table-cell sm:px-4">{a.province}</td>
                      <td className="px-3 py-3 sm:px-4">{programLabel(a.programType, a.programCategory)}</td>
                      <td className="px-3 py-3 sm:px-4">${a.requestedAmount.toString()}</td>
                      <td className="px-3 py-3 sm:px-4">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="hidden px-3 py-3 text-gray-500 sm:table-cell sm:px-4">
                        {a.createdAt.toLocaleDateString('en-CA')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
    </div>
  );
}
