import type { ApplicationStatus, ConfirmationStatus } from '@prisma/client';

/**
 * Deal progress tracker. The linear steps (Approved → In for funding → Funded)
 * reflect the deal's CURRENT status, so moving a deal backward (e.g. Approved →
 * Under review) un-lights the later steps instead of leaving them green. The
 * fact-based steps (docs uploaded, confirmation completed, paid) reflect whether
 * that thing has actually happened, regardless of status. Off-path states
 * (Problem / Declined / Withdrawn) are surfaced separately via offPathFlag().
 */

export interface ProgressSignals {
  status: ApplicationStatus;
  approvedById?: string | null; // accepted for compatibility; not used
  confirmationStatus: ConfirmationStatus;
  hasFundingDocs: boolean;
  hasPayouts: boolean;
  // The journal's confirmed Date Paid (set by the paid-sync when Result = OK +
  // Date Paid). A deal is "Paid" once EITHER a payout receipt exists OR the
  // journal confirms it was paid — the amount can fill in separately.
  journalPaidOn?: Date | string | null;
}

export interface ProgressStage {
  key: string;
  label: string;
  done: boolean;
}

// How far along the happy path each status sits. Stage positions:
// 1 Submitted · 2 Approved · 3 Docs uploaded · 5 In for funding · 6 Funded.
const STATUS_RANK: Record<ApplicationStatus, number> = {
  DRAFT: 0,
  SUBMITTED: 1,
  UNDER_REVIEW: 1,
  CONDITIONAL: 2,
  APPROVED: 2,
  DOCS_SENT: 2,
  FUNDING_SUBMITTED: 3,
  FUNDING_REVIEW: 5,
  FUNDED: 6,
  // Off-path / terminal — no forward progress implied (see offPathFlag).
  DECLINED: 0,
  WITHDRAWN: 0,
  PROBLEM: 0,
};

export function dealProgress(s: ProgressSignals): ProgressStage[] {
  const rank = STATUS_RANK[s.status] ?? 0;
  // Paid = a recorded payout OR the journal confirming it was paid (Date Paid).
  const isPaid = s.hasPayouts || !!s.journalPaidOn;

  // A stage is "done" only once the deal has genuinely moved PAST it — so the
  // current-stage marker (the first not-done stage) sits on the stage the deal is
  // actually AT, not the next one it's heading toward. Marking a stage done the
  // moment the deal *reaches* it pushed the marker one step ahead, so a just-
  // submitted deal looked like it was already up for approval, and a freshly
  // approved deal (e.g. an instant-approved Financeit deal) jumped straight to
  // "Docs uploaded".
  //
  //  - "Submitted" is behind us once the deal is approved or later (rank >= 2). A
  //    SUBMITTED / UNDER_REVIEW deal therefore rests on "Submitted" until a
  //    reviewer approves it.
  //  - "Docs uploaded" is done once the dealer's funding docs are in (or the deal
  //    is further along). "Approved" is behind us once we've moved past the
  //    approval-prep stage — i.e. those docs are in OR the install paperwork has
  //    been sent (DOCS_SENT) — so a freshly approved deal rests on "Approved".
  const docsDone = s.hasFundingDocs || rank >= 3;
  const pastApproval = docsDone || s.status === 'DOCS_SENT';
  return [
    { key: 'submitted', label: 'Submitted', done: rank >= 2 },
    { key: 'approved', label: 'Approved', done: pastApproval },
    { key: 'docs', label: 'Docs uploaded', done: docsDone },
    { key: 'confirmation', label: 'Confirmation', done: s.confirmationStatus === 'COMPLETED' },
    // Being paid means the deal reached funding and was funded — so these earlier
    // milestones can never lag behind "Paid".
    { key: 'funding', label: 'In for funding', done: rank >= 5 || isPaid },
    { key: 'funded', label: 'Funded', done: rank >= 6 || isPaid },
    { key: 'paid', label: 'Paid', done: isPaid },
  ];
}

/** How many stages are complete. */
export function doneCount(stages: ProgressStage[]): number {
  return stages.filter((s) => s.done).length;
}

/** Whole-number percent complete across all stages. */
export function progressPercent(stages: ProgressStage[]): number {
  return Math.round((doneCount(stages) / stages.length) * 100);
}

/** Index of the current (first not-yet-done) stage, or -1 when all are done. */
export function currentStageIndex(stages: ProgressStage[]): number {
  return stages.findIndex((s) => !s.done);
}

/** A deal that's off the normal track — shown as a coloured flag on the tracker. */
export function offPathFlag(status: ApplicationStatus): { label: string; cls: string } | null {
  switch (status) {
    case 'PROBLEM':
      return { label: 'Problem', cls: 'bg-orange-100 text-orange-800' };
    case 'DECLINED':
      return { label: 'Declined', cls: 'bg-red-100 text-red-800' };
    case 'WITHDRAWN':
      return { label: 'Withdrawn', cls: 'bg-gray-200 text-gray-700' };
    default:
      return null;
  }
}
