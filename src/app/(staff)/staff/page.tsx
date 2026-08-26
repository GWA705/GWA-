import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SearchBox } from '@/components/SearchBox';
import { QueueSortControl } from '@/components/QueueSortControl';
import { QUEUE_SORTS } from '@/lib/sortOptions';
import { searchWhere } from '@/lib/search';
import { STATUS_LABELS_SHORT, PROGRAM_CATEGORY_LABELS, programLabel } from '@/lib/constants';
import { ReviewerQueue, DealTable, type QueueRow, type Tone, type Lanes, type PriorityBands } from './ReviewerQueue';
import type { Application, ApplicationStatus, Dealer } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Deals waiting on the reviewer longer than this (during business hours) are
// flagged red — the 2-hour service target.
const SLA_MINUTES = 120;

const NEW_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
const FUNDING_STATUSES: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const TERMINAL: ApplicationStatus[] = ['FUNDED', 'DECLINED', 'WITHDRAWN', 'DRAFT'];

type Deal = Application & { dealer: Dealer; _count: { payouts: number } };

// Paid = a recorded payout OR the sales journal showing the deal settled.
function isPaid(a: Deal): boolean {
  return a._count.payouts > 0 || a.journalPaidOn != null;
}

// Sort for the flat "All deals" list + search results (the urgency lanes keep
// their own longest-waiting order).
function sortDeals(list: Deal[], sort: string): Deal[] {
  const s = [...list];
  switch (sort) {
    case 'oldest': return s.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case 'amount_high': return s.sort((a, b) => Number(b.requestedAmount) - Number(a.requestedAmount));
    case 'amount_low': return s.sort((a, b) => Number(a.requestedAmount) - Number(b.requestedAmount));
    case 'name': return s.sort((a, b) => `${a.applicantLastName} ${a.applicantFirstName}`.localeCompare(`${b.applicantLastName} ${b.applicantFirstName}`));
    case 'status': return s.sort((a, b) => a.status.localeCompare(b.status));
    default: return s.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// A deal "needs the reviewer" when the dealer did the last thing on it and no
// reviewer has responded since — plus anything flagged Problem.
function needsAttention(a: Deal): boolean {
  if (a.status === 'PROBLEM') return true;
  if (TERMINAL.includes(a.status)) return false;
  if (!a.lastDealerActionAt) return a.status === 'SUBMITTED' || a.status === 'FUNDING_SUBMITTED';
  return !a.lastReviewerActionAt || a.lastDealerActionAt > a.lastReviewerActionAt;
}

function waitingSince(a: Deal): Date {
  if (needsAttention(a)) return a.lastDealerActionAt ?? a.createdAt;
  return a.lastReviewerActionAt ?? a.updatedAt ?? a.createdAt;
}

function minutesSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 60_000);
}

function waitLabel(d: Date): string {
  const mins = minutesSince(d);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hrs < 24) return remM ? `${hrs}h ${remM}m` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  const remH = hrs % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

function toneFor(status: ApplicationStatus): Tone {
  switch (status) {
    case 'SUBMITTED': return 'new';
    case 'UNDER_REVIEW': return 'review';
    case 'APPROVED':
    case 'CONDITIONAL': return 'appr';
    case 'DOCS_SENT': return 'sent';
    case 'FUNDING_SUBMITTED':
    case 'FUNDING_REVIEW': return 'fund';
    case 'FUNDED': return 'funded';
    case 'PROBLEM': return 'prob';
    default: return 'decl';
  }
}

// The "what changed" chip for the Updates lane.
function activityFor(a: Deal): { label: string; tone: Tone } | null {
  if (!needsAttention(a)) return null;
  if (a.status === 'PROBLEM') return { label: 'Problem', tone: 'prob' };
  switch (a.lastDealerActionKind) {
    case 'FUNDING': return { label: 'Funding ready', tone: 'fund' };
    case 'DOCUMENT': return { label: 'New document', tone: 'review' };
    case 'NOTE': return { label: 'New note', tone: 'note' };
    case 'SUBMITTED': return { label: 'New deal', tone: 'new' };
    default:
      if (a.status === 'FUNDING_SUBMITTED') return { label: 'Funding ready', tone: 'fund' };
      return { label: 'Update', tone: 'decl' };
  }
}

function fmtAmount(a: Deal): string {
  return '$' + Math.round(Number(a.requestedAmount)).toLocaleString('en-CA');
}

// The one plain-language action a deal needs (Priority view chip).
function actionFor(a: Deal): { label: string; tone: Tone } {
  if (isPaid(a)) return { label: 'Paid — done', tone: 'paid' };
  if (a.status === 'PROBLEM') return { label: 'Fix problem', tone: 'prob' };
  if (NEW_STATUSES.includes(a.status)) return { label: 'Approve', tone: 'new' };
  if (needsAttention(a)) {
    switch (a.lastDealerActionKind) {
      case 'DOCUMENT': return { label: 'Review docs', tone: 'review' };
      case 'NOTE': return { label: 'Reply', tone: 'note' };
      case 'FUNDING': return { label: 'Fund', tone: 'fund' };
      default:
        return a.status === 'FUNDING_SUBMITTED'
          ? { label: 'Fund', tone: 'fund' }
          : { label: 'Review', tone: 'review' };
    }
  }
  // Not on the reviewer's desk right now — name the actual stage instead of a
  // generic "Awaiting dealer" on every row.
  switch (a.status) {
    case 'APPROVED':
    case 'CONDITIONAL':
    case 'DOCS_SENT':
      return { label: 'Awaiting install', tone: 'decl' }; // ball is with the dealer
    case 'FUNDING_SUBMITTED':
      return { label: 'Verify & fund', tone: 'fund' };
    case 'FUNDING_REVIEW':
      return { label: 'In for funding', tone: 'fund' }; // submitted to the funder
    case 'FUNDED':
      return { label: 'Pay dealer', tone: 'fund' };
    default:
      return { label: 'In progress', tone: 'decl' };
  }
}

function toRow(a: Deal): QueueRow {
  const attention = needsAttention(a);
  const since = waitingSince(a);
  const activity = activityFor(a);
  const action = actionFor(a);
  return {
    id: a.id,
    applicant: `${a.applicantFirstName} ${a.applicantLastName}`,
    dealer: a.dealer.name,
    program: programLabel(a.programType, a.programCategory),
    programType: a.programType,
    programCategory: PROGRAM_CATEGORY_LABELS[a.programCategory],
    amount: fmtAmount(a),
    statusLabel: isPaid(a) ? 'Paid' : STATUS_LABELS_SHORT[a.status] ?? a.status,
    tone: isPaid(a) ? 'paid' : toneFor(a.status),
    paid: isPaid(a),
    activityLabel: activity?.label ?? null,
    activityTone: activity?.tone ?? null,
    waitLabel: waitLabel(since),
    waitHot: attention && minutesSince(since) >= SLA_MINUTES,
    dateLabel: a.createdAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
    actionLabel: action.label,
    actionTone: action.tone,
  };
}

const byWaiting = (a: Deal, b: Deal) => waitingSince(a).getTime() - waitingSince(b).getTime();


// The most recent moment anything happened on a deal.
function lastActivityAt(a: Deal): number {
  return Math.max(
    a.lastDealerActionAt?.getTime() ?? 0,
    a.lastReviewerActionAt?.getTime() ?? 0,
    a.updatedAt?.getTime() ?? 0,
    a.createdAt.getTime(),
  );
}
const byRecentActivity = (a: Deal, b: Deal) => lastActivityAt(b) - lastActivityAt(a);

export default async function StaffQueue({ searchParams }: { searchParams: { q?: string; sort?: string } }) {
  await requireStaffSection('review-queue');
  const q = (searchParams.q ?? '').trim();
  const search = searchWhere(q);
  const sort = QUEUE_SORTS.some((s) => s.value === searchParams.sort) ? searchParams.sort! : 'newest';

  // --- Search mode: one flat list across every deal. ---
  if (search) {
    const matches = (await prisma.application.findMany({
      where: search,
      include: { dealer: true, _count: { select: { payouts: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })) as Deal[];
    const rows = sortDeals(matches, sort).map(toRow);
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox action="/staff" q={q} />
            <QueueSortControl sort={sort} />
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {rows.length} match{rows.length === 1 ? '' : 'es'} for “{q}”.{' '}
          <Link href="/staff" className="text-brand-700 hover:underline">Back to all deals</Link>
        </p>
        {rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No deals match “{q}”.</div>
        ) : (
          <DealTable rows={rows} kind="all" />
        )}
      </div>
    );
  }

  // --- Browse mode: four lanes for the toggle/tabs view. ---
  const apps = (await prisma.application.findMany({
    include: { dealer: true, _count: { select: { payouts: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })) as Deal[];

  const lanes: Lanes = {
    needsApproval: apps.filter((a) => NEW_STATUSES.includes(a.status)).sort(byWaiting).map(toRow),
    updates: apps.filter((a) => needsAttention(a) && !NEW_STATUSES.includes(a.status)).sort(byWaiting).map(toRow),
    inFunding: apps.filter((a) => FUNDING_STATUSES.includes(a.status) && !isPaid(a)).sort(byWaiting).map(toRow),
    all: sortDeals(apps, sort).map(toRow),
  };

  // Priority view: the active pipeline grouped by urgency instead of status.
  const INACTIVE: ApplicationStatus[] = ['DECLINED', 'WITHDRAWN', 'DRAFT'];
  const active = apps.filter((a) => !INACTIVE.includes(a.status) && !isPaid(a));
  const priority: PriorityBands = {
    // Band 1 — waiting for an approve / decline decision (Submitted / Under review).
    approval: active.filter((a) => NEW_STATUSES.includes(a.status)).sort(byWaiting).map(toRow),
    // Band 2 — already approved but the reviewer must act: a new document was
    // uploaded, the dealer changed something, a reply is owed, or it's flagged a
    // Problem. Longest-waiting (incl. overdue) first.
    attention: active.filter((a) => !NEW_STATUSES.includes(a.status) && needsAttention(a)).sort(byWaiting).map(toRow),
    // Band 3 — moving along / waiting on the dealer: newest activity first.
    prog: active.filter((a) => !NEW_STATUSES.includes(a.status) && !needsAttention(a)).sort(byRecentActivity).map(toRow),
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox action="/staff" q={q} />
          <QueueSortControl sort={sort} />
        </div>
      </div>
      <ReviewerQueue lanes={lanes} priority={priority} />
    </div>
  );
}
