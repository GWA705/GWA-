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
  return [
    { key: 'submitted', label: 'Submitted', done: s.status !== 'DRAFT' },
    { key: 'approved', label: 'Approved', done: rank >= 2 },
    { key: 'docs', label: 'Docs uploaded', done: s.hasFundingDocs || rank >= 3 },
    { key: 'confirmation', label: 'Confirmation', done: s.confirmationStatus === 'COMPLETED' },
    { key: 'funding', label: 'In for funding', done: rank >= 5 },
    { key: 'funded', label: 'Funded', done: rank >= 6 },
    { key: 'paid', label: 'Paid', done: s.hasPayouts },
  ];
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
