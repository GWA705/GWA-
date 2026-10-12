import Link from 'next/link';
import { SectionHero } from '@/components/SectionHero';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { SearchBox } from '@/components/SearchBox';
import { QueueSortControl } from '@/components/QueueSortControl';
import { QUEUE_SORTS } from '@/lib/sortOptions';
import { searchWhere } from '@/lib/search';
import { programDisplayLabel, programCategoryLabel } from '@/lib/enumLabels';
import { getT } from '@/i18n/server';
import type { TFunction } from '@/i18n/translator';
import { ReviewerQueue, DealTable, type QueueRow, type Tone, type Lanes, type PriorityBands } from './ReviewerQueue';
import { MorningCatchUp } from './MorningCatchUp';
import { buildCatchUp } from '@/lib/catchUp';
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

function waitLabel(d: Date, t: TFunction): string {
  const mins = minutesSince(d);
  if (mins < 1) return t('staffMisc.home.justNow');
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
function activityFor(a: Deal, t: TFunction): { label: string; tone: Tone } | null {
  if (!needsAttention(a)) return null;
  if (a.status === 'PROBLEM') return { label: t('staffMisc.home.act.problem'), tone: 'prob' };
  switch (a.lastDealerActionKind) {
    case 'FUNDING': return { label: t('staffMisc.home.act.fundingReady'), tone: 'fund' };
    case 'DOCUMENT': return { label: t('staffMisc.home.act.newDocument'), tone: 'review' };
    case 'NOTE': return { label: t('staffMisc.home.act.newNote'), tone: 'note' };
    case 'SUBMITTED': return { label: t('staffMisc.home.act.newDeal'), tone: 'new' };
    default:
      if (a.status === 'FUNDING_SUBMITTED') return { label: t('staffMisc.home.act.fundingReady'), tone: 'fund' };
      return { label: t('staffMisc.home.act.update'), tone: 'decl' };
  }
}

function fmtAmount(a: Deal): string {
  return '$' + Math.round(Number(a.requestedAmount)).toLocaleString('en-CA');
}

// The one plain-language action a deal needs (Priority view chip).
function actionFor(a: Deal, t: TFunction): { label: string; tone: Tone } {
  if (isPaid(a)) return { label: t('staffMisc.home.action.paidDone'), tone: 'paid' };
  if (a.status === 'PROBLEM') return { label: t('staffMisc.home.action.fixProblem'), tone: 'prob' };
  if (NEW_STATUSES.includes(a.status)) return { label: t('staffMisc.home.action.approve'), tone: 'new' };
  if (needsAttention(a)) {
    switch (a.lastDealerActionKind) {
      case 'DOCUMENT': return { label: t('staffMisc.home.action.reviewDocs'), tone: 'review' };
      case 'NOTE': return { label: t('staffMisc.home.action.reply'), tone: 'note' };
      case 'FUNDING': return { label: t('staffMisc.home.action.fund'), tone: 'fund' };
      default:
        return a.status === 'FUNDING_SUBMITTED'
          ? { label: t('staffMisc.home.action.fund'), tone: 'fund' }
          : { label: t('staffMisc.home.action.review'), tone: 'review' };
    }
  }
  // Not on the reviewer's desk right now — name the actual stage instead of a
  // generic "Awaiting dealer" on every row.
  switch (a.status) {
    case 'APPROVED':
    case 'CONDITIONAL':
    case 'DOCS_SENT':
      return { label: t('staffMisc.home.action.awaitingInstall'), tone: 'decl' }; // ball is with the dealer
    case 'FUNDING_SUBMITTED':
      return { label: t('staffMisc.home.action.verifyFund'), tone: 'fund' };
    case 'FUNDING_REVIEW':
      return { label: t('staffMisc.home.action.inForFunding'), tone: 'fund' }; // submitted to the funder
    case 'FUNDED':
      return { label: t('staffMisc.home.action.payDealer'), tone: 'fund' };
    default:
      return { label: t('staffMisc.home.action.inProgress'), tone: 'decl' };
  }
}

function toRow(a: Deal, t: TFunction): QueueRow {
  const attention = needsAttention(a);
  const since = waitingSince(a);
  const activity = activityFor(a, t);
  const action = actionFor(a, t);
  return {
    id: a.id,
    applicant: `${a.applicantFirstName} ${a.applicantLastName}`,
    dealer: a.dealer.name,
    program: programDisplayLabel(t, a.programType, a.programCategory),
    programType: a.programType,
    programCategory: programCategoryLabel(t, a.programCategory),
    amount: fmtAmount(a),
    statusLabel: isPaid(a) ? t('staffMisc.home.paid') : t(`enum.statusShort.${a.status}`),
    tone: isPaid(a) ? 'paid' : toneFor(a.status),
    paid: isPaid(a),
    activityLabel: activity?.label ?? null,
    activityTone: activity?.tone ?? null,
    waitLabel: waitLabel(since, t),
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
  const session = await requireStaffSection('review-queue');
  const t = getT();
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
    const rows = sortDeals(matches, sort).map((a) => toRow(a, t));
    return (
      <div>
        <div className="mb-5 space-y-4">
          <SectionHero eyebrow={t('staffMisc.home.heroEyebrow')} title={t('staffMisc.home.heroTitle')} subtitle={t('staffMisc.home.heroSubtitle')} />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchBox action="/staff" q={q} />
            <QueueSortControl sort={sort} />
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {rows.length} {rows.length === 1 ? t('staffMisc.home.match') : t('staffMisc.home.matches')} {t('staffMisc.home.forQuery', { q })}{' '}
          <Link href="/staff" className="text-brand-700 hover:underline">{t('staffMisc.home.backToAllDeals')}</Link>
        </p>
        {rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">{t('staffMisc.home.noDealsMatch', { q })}</div>
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
    needsApproval: apps.filter((a) => NEW_STATUSES.includes(a.status)).sort(byWaiting).map((a) => toRow(a, t)),
    updates: apps.filter((a) => needsAttention(a) && !NEW_STATUSES.includes(a.status)).sort(byWaiting).map((a) => toRow(a, t)),
    // In-progress / funding deals: most recently touched first, so a deal you
    // just handled lands at the TOP of the list, not the bottom.
    inFunding: apps.filter((a) => FUNDING_STATUSES.includes(a.status) && !isPaid(a)).sort(byRecentActivity).map((a) => toRow(a, t)),
    all: sortDeals(apps, sort).map((a) => toRow(a, t)),
  };

  // Priority view: the active pipeline grouped by urgency instead of status.
  const INACTIVE: ApplicationStatus[] = ['DECLINED', 'WITHDRAWN', 'DRAFT'];
  const active = apps.filter((a) => !INACTIVE.includes(a.status) && !isPaid(a));
  const priority: PriorityBands = {
    // Band 1 — waiting for an approve / decline decision (Submitted / Under review).
    approval: active.filter((a) => NEW_STATUSES.includes(a.status)).sort(byWaiting).map((a) => toRow(a, t)),
    // Band 2 — already approved but the reviewer must act: a new document was
    // uploaded, the dealer changed something, a reply is owed, or it's flagged a
    // Problem. Longest-waiting (incl. overdue) first.
    attention: active.filter((a) => !NEW_STATUSES.includes(a.status) && needsAttention(a)).sort(byWaiting).map((a) => toRow(a, t)),
    // Band 3 — moving along / waiting on the dealer: newest activity first.
    prog: active.filter((a) => !NEW_STATUSES.includes(a.status) && !needsAttention(a)).sort(byRecentActivity).map((a) => toRow(a, t)),
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{t('staffMisc.home.heroTitle')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/staff/cancellations" className="btn-secondary text-sm">{t('staffMisc.home.cancellationsLink')}</Link>
          <Link href="/staff/confirmations" className="btn-secondary text-sm">{t('staffMisc.home.confirmationsLink')}</Link>
          <SearchBox action="/staff" q={q} />
          <QueueSortControl sort={sort} />
        </div>
      </div>
      <MorningCatchUp data={await buildCatchUp(session.userId)} />
      <ReviewerQueue lanes={lanes} priority={priority} />
    </div>
  );
}
