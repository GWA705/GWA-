import type { ApplicationStatus } from '@prisma/client';

/**
 * The reviewer's real-world workflow, as seven ordered phases. The reviewer page
 * lays itself out around these so the page follows the job instead of showing
 * every section at once. Each phase also carries the plain-language label the
 * DEALER sees while the deal sits in that phase, so status stays in sync on both
 * sides without anyone touching a dropdown.
 */

export type PhaseState = 'done' | 'now' | 'todo';

export interface ReviewerPhase {
  id: string;
  index: number; // 1..7
  title: string; // reviewer-facing
  sub: string; // short reviewer hint
  dealerLabel: string; // what the dealer sees during this phase
}

export const REVIEWER_PHASES: ReviewerPhase[] = [
  { id: 'decide', index: 1, title: 'Review & decide', sub: 'Check the applicant, then approve or decline', dealerLabel: 'Under review' },
  { id: 'produce', index: 2, title: 'Produce install documents', sub: 'Upload the paperwork the dealer needs to install', dealerLabel: 'Approved — preparing your documents' },
  { id: 'await', index: 3, title: 'Sent — awaiting install', sub: 'Dealer installs and returns the signed documents', dealerLabel: 'Awaiting your signed documents' },
  { id: 'review', index: 4, title: 'Review signed documents', sub: 'Confirm every signed document and photo is correct', dealerLabel: 'Reviewing your documents' },
  { id: 'submit', index: 5, title: 'Submit to finance company', sub: 'Record the deal numbers and send it in', dealerLabel: 'Submitted to finance company' },
  { id: 'funding', index: 6, title: 'Awaiting funding', sub: 'Wait for the funder, then mark it Funded', dealerLabel: 'In for funding' },
  { id: 'pay', index: 7, title: 'Pay dealer', sub: 'Record the payout — the deal is complete', dealerLabel: 'Funded — paying the dealer' },
];

// Signals used (alongside status) to place a deal that the current status set
// can't distinguish on its own — e.g. "approved" covers both "producing docs"
// and "sent, waiting on install".
export interface FlowSignals {
  status: ApplicationStatus;
  reviewerDocsSent: boolean; // reviewer has uploaded install paperwork for the dealer
  fundingDocsReceived: boolean; // dealer has returned the signed funding package
  hasPayouts: boolean;
}

/** The phase index (1..7) a deal is currently in. */
export function currentPhaseIndex(s: FlowSignals): number {
  switch (s.status) {
    case 'DRAFT':
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'DECLINED':
    case 'WITHDRAWN':
      return 1;
    case 'CONDITIONAL':
    case 'APPROVED':
    case 'PROBLEM':
      // Dealer already returned signed docs → jump to review; else awaiting
      // install once paperwork is out; otherwise still producing documents.
      if (s.fundingDocsReceived) return 4;
      if (s.reviewerDocsSent) return 3;
      return 2;
    case 'FUNDING_SUBMITTED':
      return 4; // dealer returned the package, reviewer is checking it
    case 'FUNDING_REVIEW':
      return s.hasPayouts ? 7 : 6; // in for funding / awaiting funder
    case 'FUNDED':
      return 7;
    default:
      return 1;
  }
}

/** Resolve each phase's state (done / now / todo) for a deal. */
export function reviewerPhaseStates(s: FlowSignals): (ReviewerPhase & { state: PhaseState })[] {
  const current = currentPhaseIndex(s);
  return REVIEWER_PHASES.map((p) => ({
    ...p,
    state: p.index < current ? 'done' : p.index === current ? 'now' : 'todo',
  }));
}

/** The plain-language status the dealer currently sees for this deal. */
export function dealerFacingStatus(s: FlowSignals): string {
  switch (s.status) {
    case 'DECLINED':
      return 'Declined';
    case 'WITHDRAWN':
      return 'Withdrawn';
    case 'PROBLEM':
      return 'On hold — we need something from you';
    default:
      return REVIEWER_PHASES[currentPhaseIndex(s) - 1].dealerLabel;
  }
}
