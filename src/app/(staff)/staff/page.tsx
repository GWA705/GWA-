import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { StatusBadge } from '@/components/StatusBadge';
import { SearchBox } from '@/components/SearchBox';
import { searchWhere } from '@/lib/search';
import { programLabel } from '@/lib/constants';
import type { Application, ApplicationStatus, Dealer, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Deals waiting on the reviewer longer than this (during business hours) are
// flagged red. This mirrors the 2-hour service target reviewers work to.
const SLA_MINUTES = 120;

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

// Statuses that are finished — never surface these under "Attention needed".
const TERMINAL: ApplicationStatus[] = ['FUNDED', 'DECLINED', 'WITHDRAWN', 'DRAFT'];

function whereFor(key: string): Prisma.ApplicationWhereInput {
  const group = GROUPS.find((g) => g.key === key) ?? GROUPS[0];
  if (group.paid) return { payouts: { some: {} } };
  if (group.statuses) return { status: { in: group.statuses } };
  return {};
}

type QueueDeal = Application & {
  dealer: Dealer;
  _count: { documents: number; payouts: number };
};

/**
 * A deal "needs the reviewer" when the dealer did the last thing on it (submit,
 * upload, note, funding) and no reviewer has responded since — plus anything
 * flagged as a Problem. Reviewer actions call markReviewerAction(), which moves
 * the deal out of this bucket automatically.
 */
function needsAttention(a: QueueDeal): boolean {
  if (a.status === 'PROBLEM') return true;
  if (TERMINAL.includes(a.status)) return false;
  if (!a.lastDealerActionAt) {
    // Older deals with no signal recorded: fall back to raw status.
    return a.status === 'SUBMITTED' || a.status === 'FUNDING_SUBMITTED';
  }
  return !a.lastReviewerActionAt || a.lastDealerActionAt > a.lastReviewerActionAt;
}

type Signal = { label: string; cls: string };

// The chip shown on an attention deal, describing what the dealer just did.
function attentionSignal(a: QueueDeal): Signal {
  if (a.status === 'PROBLEM') return { label: 'Problem', cls: 'bg-red-100 text-red-800' };
  switch (a.lastDealerActionKind) {
    case 'SUBMITTED':
      return { label: 'New deal', cls: 'bg-blue-100 text-blue-800' };
    case 'FUNDING':
      return { label: 'Funding ready', cls: 'bg-indigo-100 text-indigo-800' };
    case 'DOCUMENT':
      return { label: 'New document', cls: 'bg-sky-100 text-sky-800' };
    case 'NOTE':
      return { label: 'New note', cls: 'bg-amber-100 text-amber-800' };
    default:
      if (a.status === 'FUNDING_SUBMITTED') return { label: 'Funding ready', cls: 'bg-indigo-100 text-indigo-800' };
      if (a.status === 'SUBMITTED') return { label: 'New deal', cls: 'bg-blue-100 text-blue-800' };
      return { label: 'Update', cls: 'bg-gray-100 text-gray-700' };
  }
}

// When the ball landed in the reviewer's court (for attention deals) — used for
// the waiting clock.
function waitingSince(a: QueueDeal): Date {
  if (needsAttention(a)) return a.lastDealerActionAt ?? a.createdAt;
  return a.lastReviewerActionAt ?? a.updatedAt ?? a.createdAt;
}

// Human "2h 15m" / "45m" / "3d 2h" / "just now" waiting label.
function waitLabel(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hrs < 24) return remM ? `${hrs}h ${remM}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remH = hrs % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

function minutesSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 60_000);
}

function DealRow({ a }: { a: QueueDeal }) {
  const attention = needsAttention(a);
  const since = waitingSince(a);
  const overdue = attention && minutesSince(since) >= SLA_MINUTES;
  const signal = attention ? attentionSignal(a) : null;

  const rowCls = overdue
    ? 'bg-red-50/60 hover:bg-red-50'
    : attention
      ? 'bg-amber-50/50 hover:bg-amber-50'
      : 'hover:bg-gray-50';
  const barCls = overdue ? 'bg-red-500' : attention ? 'bg-amber-400' : 'bg-transparent';

  return (
    <tr className={rowCls}>
      <td className="w-1 p-0">
        <div className={`h-full w-1 ${barCls}`} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {attention && (
            <span
              className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white ${overdue ? 'bg-red-500' : 'bg-amber-400'}`}
              title={overdue ? 'Waiting over 2 hours' : 'Needs attention'}
            >
              !
            </span>
          )}
          <Link href={`/staff/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">
            {a.applicantFirstName} {a.applicantLastName}
          </Link>
          {a._count.payouts > 0 && <span className="badge bg-emerald-100 text-emerald-800">Paid</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{a.dealer.name}</td>
      <td className="px-4 py-3">{programLabel(a.programType, a.programCategory)}</td>
      <td className="px-4 py-3 tabular-nums">${a.requestedAmount.toString()}</td>
      <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
      <td className="px-4 py-3">
        {signal ? <span className={`badge ${signal.cls}`}>{signal.label}</span> : <span className="text-gray-300">—</span>}
      </td>
      <td className={`px-4 py-3 tabular-nums ${overdue ? 'font-semibold text-red-700' : 'text-gray-500'}`}>
        {waitLabel(since)}
      </td>
    </tr>
  );
}

function DealTable({ deals }: { deals: QueueDeal[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="w-1 p-0" />
            <th className="px-4 py-3">Applicant</th>
            <th className="px-4 py-3">Dealer</th>
            <th className="px-4 py-3">Program</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Activity</th>
            <th className="px-4 py-3">Waiting</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {deals.map((a) => (
            <DealRow key={a.id} a={a} />
          ))}
        </tbody>
      </table>
    </div>
  );
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

  // Split into the two areas the reviewer works from.
  const attention = apps.filter(needsAttention);
  // Attention deals sort by longest-waiting first (most overdue at the top).
  attention.sort((a, b) => waitingSince(a).getTime() - waitingSince(b).getTime());
  const rest = apps.filter((a) => !needsAttention(a));

  const countByStatus = (s: ApplicationStatus) =>
    statusCounts.find((c) => c.status === s)?._count ?? 0;
  const groupCount = (g: (typeof GROUPS)[number]) => {
    if (g.key === 'all') return statusCounts.reduce((n, c) => n + c._count, 0);
    if (g.paid) return paidCount;
    return (g.statuses ?? []).reduce((n, s) => n + countByStatus(s), 0);
  };

  const isSearch = !!searchParams.q;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
        <SearchBox action="/staff" q={searchParams.q} />
      </div>

      {isSearch ? (
        <p className="mb-4 text-sm text-gray-500">
          Search results for “{searchParams.q}” — {apps.length} match(es).{' '}
          <Link href="/staff" className="text-brand-700 hover:underline">Back to all deals</Link>
        </p>
      ) : null}

      {/* Status filter menu */}
      <div className={`mb-5 flex flex-wrap gap-2 ${isSearch ? 'hidden' : ''}`}>
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

      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-white p-3 text-xs text-gray-600 ring-1 ring-inset ring-gray-200">
        <span className="font-semibold text-gray-700">Legend:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">!</span>
          Needs attention
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">!</span>
          Waiting over 2 hours
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="badge bg-blue-100 text-blue-800">New deal</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="badge bg-indigo-100 text-indigo-800">Funding ready</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="badge bg-sky-100 text-sky-800">New document</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="badge bg-amber-100 text-amber-800">New note</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="badge bg-red-100 text-red-800">Problem</span></span>
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-500">No deals in this view.</div>
      ) : (
        <div className="space-y-8">
          {/* Attention needed */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Attention needed</h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{attention.length}</span>
            </div>
            {attention.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-500">
                Nothing needs your attention right now. 🎉
              </div>
            ) : (
              <DealTable deals={attention} />
            )}
          </section>

          {/* Everything else */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">In progress</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{rest.length}</span>
            </div>
            {rest.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-500">No other deals in this view.</div>
            ) : (
              <DealTable deals={rest} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
