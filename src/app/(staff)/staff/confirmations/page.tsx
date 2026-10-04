import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { STATUS_LABELS_SHORT } from '@/lib/constants';
import {
  confirmationWorkState,
  confirmationEligible,
  confirmationCheckedCount,
  confirmationChecksRemaining,
  flowSignalsFor,
  CONFIRMATION_CHECK_COUNT,
  type ConfirmationWorkState,
} from '@/lib/confirmationWork';
import { ConfirmationWorklist, type CallRow } from './ConfirmationWorklist';
import type { ApplicationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// A confirmation that still hasn't happened this long after the deal became
// ready is flagged overdue (red). Confirmation calls aren't on the 2-hour deal
// SLA — they run on a slower clock — so this is a days threshold, not hours.
const OVERDUE_DAYS = 3;

// Statuses a deal can be in at or after the review stage, where a confirmation
// call may be due. (Eligibility is decided precisely by confirmationEligible;
// this just narrows the fetch.) Deals already flagged ISSUE or COMPLETED are
// pulled in regardless of status so they always show.
const CANDIDATE_STATUSES: ApplicationStatus[] = [
  'DOCS_SENT',
  'APPROVED',
  'CONDITIONAL',
  'PROBLEM',
  'FUNDING_SUBMITTED',
  'FUNDING_REVIEW',
  'FUNDED',
];

function torontoDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function torontoTime(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).format(d);
}

function ageLabel(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default async function ConfirmationsPage() {
  await requireStaffSection('confirmations');
  const now = Date.now();
  const todayStr = torontoDay(new Date(now));

  const apps = await prisma.application.findMany({
    where: {
      OR: [
        { status: { in: CANDIDATE_STATUSES } },
        { confirmationStatus: { in: ['ISSUE', 'COMPLETED'] } },
      ],
    },
    select: {
      id: true,
      applicantFirstName: true,
      applicantLastName: true,
      status: true,
      confirmationStatus: true,
      programType: true,
      programCategory: true,
      hdReference: true,
      updatedAt: true,
      lastDealerActionAt: true,
      dealer: { select: { name: true } },
      documents: { select: { stage: true, createdAt: true } },
      confirmation: {
        select: {
          installedWorking: true,
          performingAsRepresented: true,
          receivedEverything: true,
          termsAgreed: true,
          signatureConfirmed: true,
          notTrialOffer: true,
          completedAt: true,
          confirmedBy: { select: { name: true } },
        },
      },
      conversation: {
        select: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { fromStaff: true, auto: true, body: true, createdAt: true },
          },
        },
      },
      _count: { select: { payouts: true } },
    },
    take: 600,
  });

  const rows: CallRow[] = [];

  for (const a of apps) {
    const signals = flowSignalsFor(a.status, a.documents, a._count.payouts);
    const eligible = confirmationEligible(signals);
    const checked = confirmationCheckedCount(a.confirmation);
    const state = confirmationWorkState({ confirmationStatus: a.confirmationStatus, eligible, checked });
    if (!state) continue;

    // "Confirmed today" lane only — older completed calls are history (reachable
    // from the deal / Find customer), not part of the live worklist.
    if (state === 'DONE' && !(a.confirmation?.completedAt && torontoDay(a.confirmation.completedAt) === todayStr)) {
      continue;
    }

    // When did this become ready to call? The signed package coming back is the
    // moment — the earliest funding-stage document — falling back to the dealer's
    // last action, then the deal's own clock.
    const fundingDocTimes = a.documents.filter((d) => d.stage === 'FUNDING').map((d) => d.createdAt.getTime());
    const readyMs = fundingDocTimes.length ? Math.min(...fundingDocTimes) : (a.lastDealerActionAt ?? a.updatedAt).getTime();

    const applicant = `${a.applicantFirstName} ${a.applicantLastName}`.trim();
    const office = a.dealer.name;
    const stageLabel = STATUS_LABELS_SHORT[a.status] ?? a.status;
    const hdRef = a.hdReference?.trim() || null;

    const row: CallRow = {
      id: a.id,
      applicant,
      office,
      programType: a.programType,
      stageLabel,
      state,
      checked,
      checkTotal: CONFIRMATION_CHECK_COUNT,
      sortMs: readyMs,
      waitLabel: '',
      overdue: false,
      hdRef,
      searchText: `${applicant} ${office} ${hdRef ?? ''}`.toLowerCase(),
    };

    if (state === 'NEEDS_CALL' || state === 'IN_PROGRESS') {
      const age = now - readyMs;
      row.overdue = age >= OVERDUE_DAYS * 86_400_000;
      row.waitLabel = `Ready ${ageLabel(age)} ago`;
      if (state === 'IN_PROGRESS') {
        row.remaining = confirmationChecksRemaining(a.confirmation).join(', ');
      }
    } else if (state === 'ISSUE') {
      const last = a.conversation?.messages[0];
      // The office spoke last (a real message, not an automated notice) → it's
      // waiting on a reviewer. This is the weekend follow-up signal.
      const awaiting = !!last && !last.fromStaff && !last.auto;
      row.issueAwaitingReviewer = awaiting;
      const since = last?.createdAt.getTime() ?? readyMs;
      row.sortMs = since;
      const age = now - since;
      row.overdue = awaiting && age >= 2 * 86_400_000; // an unanswered office reply aging past 2 days
      row.waitLabel = awaiting ? `Office replied ${ageLabel(age)} ago` : 'Awaiting office';
      if (awaiting && last) row.issuePreview = last.body.slice(0, 160);
    } else {
      // DONE (today)
      const by = a.confirmation?.confirmedBy?.name ?? null;
      const at = a.confirmation?.completedAt ? torontoTime(a.confirmation.completedAt) : null;
      row.doneByLabel = by ? (at ? `${by} · ${at}` : by) : at;
      row.sortMs = a.confirmation?.completedAt?.getTime() ?? now;
    }

    rows.push(row);
  }

  // Outstanding bands sort oldest-first (most overdue at the top); confirmed-today
  // sorts newest-first. The client re-groups by state, but a stable server sort
  // means every view opens in a sensible order.
  rows.sort((x, y) => {
    if (x.state === 'DONE' && y.state === 'DONE') return y.sortMs - x.sortMs;
    return x.sortMs - y.sortMs;
  });

  const counts: Record<ConfirmationWorkState, number> = { NEEDS_CALL: 0, IN_PROGRESS: 0, ISSUE: 0, DONE: 0 };
  for (const r of rows) counts[r.state]++;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Confirmation calls</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Every deal that still needs a confirmation call, wherever it is in the pipeline — plus the flagged issues
          waiting on an office reply. Search or filter by state; open any row to make the call on the customer&apos;s deal.
        </p>
      </div>
      <ConfirmationWorklist rows={rows} counts={counts} />
    </div>
  );
}
