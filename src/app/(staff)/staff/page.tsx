import Link from 'next/link';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SearchBox } from '@/components/SearchBox';
import { searchWhere } from '@/lib/search';
import { STATUS_LABELS, programLabel } from '@/lib/constants';
import { ReviewerQueue, DealTable, type QueueRow, type Tone, type Lanes } from './ReviewerQueue';
import type { Application, ApplicationStatus, Dealer } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Deals waiting on the reviewer longer than this (during business hours) are
// flagged red — the 2-hour service target.
const SLA_MINUTES = 120;

const NEW_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
const FUNDING_STATUSES: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
const TERMINAL: ApplicationStatus[] = ['FUNDED', 'DECLINED', 'WITHDRAWN', 'DRAFT'];

type Deal = Application & { dealer: Dealer; _count: { payouts: number } };

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

function toRow(a: Deal): QueueRow {
  const attention = needsAttention(a);
  const since = waitingSince(a);
  const activity = activityFor(a);
  return {
    id: a.id,
    applicant: `${a.applicantFirstName} ${a.applicantLastName}`,
    dealer: a.dealer.name,
    program: programLabel(a.programType, a.programCategory),
    amount: fmtAmount(a),
    statusLabel: a._count.payouts > 0 ? 'Paid' : STATUS_LABELS[a.status] ?? a.status,
    tone: a._count.payouts > 0 ? 'paid' : toneFor(a.status),
    paid: a._count.payouts > 0,
    activityLabel: activity?.label ?? null,
    activityTone: activity?.tone ?? null,
    waitLabel: waitLabel(since),
    waitHot: attention && minutesSince(since) >= SLA_MINUTES,
    dateLabel: a.createdAt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
  };
}

const byWaiting = (a: Deal, b: Deal) => waitingSince(a).getTime() - waitingSince(b).getTime();

export default async function StaffQueue({ searchParams }: { searchParams: { q?: string } }) {
  await requireRole('REVIEWER', 'ADMIN');
  const q = (searchParams.q ?? '').trim();
  const search = searchWhere(q);

  // --- Search mode: one flat list across every deal. ---
  if (search) {
    const matches = (await prisma.application.findMany({
      where: search,
      include: { dealer: true, _count: { select: { payouts: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })) as Deal[];
    const rows = matches.map(toRow);
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
          <SearchBox action="/staff" q={q} />
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
    inFunding: apps.filter((a) => FUNDING_STATUSES.includes(a.status) && a._count.payouts === 0).sort(byWaiting).map(toRow),
    all: apps.map(toRow),
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Deals</h1>
        <SearchBox action="/staff" q={q} />
      </div>
      <ReviewerQueue lanes={lanes} />
    </div>
  );
}
