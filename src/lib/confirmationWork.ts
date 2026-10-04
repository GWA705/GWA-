import type { ApplicationStatus } from '@prisma/client';
import { currentPhaseIndex, hasDealerReturned, type FlowSignals } from './reviewerFlow';

/**
 * Confirmation-call worklist logic.
 *
 * The confirmation call runs on its own clock: a deal keeps advancing through
 * the pipeline (into funding, even Funded) whether or not the call has been
 * made, so the deals that still need a call scatter across stages and fall out
 * of view. This module derives a single "work state" per deal so the reviewer
 * can find, search and filter every outstanding call in one place — without
 * changing anything the dealer sees (confirmationStatus is unchanged).
 *
 * States:
 *   NEEDS_CALL   — ready to call (reached the review stage) but not started
 *   IN_PROGRESS  — the call was started; some of the six checks are done
 *   ISSUE        — a confirmation issue was flagged (shared with the follow-up queue)
 *   DONE         — confirmation completed (all six checks)
 *   null         — not on the worklist yet (not far enough along, and no issue)
 */

export type ConfirmationWorkState = 'NEEDS_CALL' | 'IN_PROGRESS' | 'ISSUE' | 'DONE';

// The six confirmation checks, in the order they're worked on the call. These are
// the boolean fields on the Confirmation record; "complete" means all six are true.
export const CONFIRMATION_CHECK_KEYS = [
  'installedWorking',
  'performingAsRepresented',
  'receivedEverything',
  'termsAgreed',
  'signatureConfirmed',
  'notTrialOffer',
] as const;
export type ConfirmationCheckKey = (typeof CONFIRMATION_CHECK_KEYS)[number];
export const CONFIRMATION_CHECK_COUNT = CONFIRMATION_CHECK_KEYS.length; // 6

// Short labels for the checks still outstanding on an in-progress call.
export const CONFIRMATION_CHECK_LABELS: Record<ConfirmationCheckKey, string> = {
  installedWorking: 'installed & working',
  performingAsRepresented: 'performing as represented',
  receivedEverything: 'received everything',
  termsAgreed: 'terms agreed',
  signatureConfirmed: 'signature confirmed',
  notTrialOffer: 'not a trial offer',
};

type ChecksSource = Partial<Record<ConfirmationCheckKey, boolean | null>> | null | undefined;

/** How many of the six confirmation checks are done. */
export function confirmationCheckedCount(c: ChecksSource): number {
  if (!c) return 0;
  let n = 0;
  for (const k of CONFIRMATION_CHECK_KEYS) if (c[k]) n++;
  return n;
}

/** The checks still outstanding (as their short labels), in call order. */
export function confirmationChecksRemaining(c: ChecksSource): string[] {
  return CONFIRMATION_CHECK_KEYS.filter((k) => !(c && c[k])).map((k) => CONFIRMATION_CHECK_LABELS[k]);
}

// A confirmation call becomes "available" once the deal reaches the review stage
// — i.e. the dealer has returned the signed package. This mirrors the gate the
// deal page already uses to light up the confirmation step (phase index >= 4 in
// reviewerFlow), so the worklist and the deal page never disagree about whether
// a call is due.
export const CONFIRMATION_READY_PHASE = 4;

/** Is this deal far enough along that a confirmation call is due? */
export function confirmationEligible(signals: FlowSignals): boolean {
  return currentPhaseIndex(signals) >= CONFIRMATION_READY_PHASE;
}

/** Build the reviewer-flow signals a deal's phase depends on, from its documents + payouts. */
export function flowSignalsFor(
  status: ApplicationStatus,
  docs: { stage: string; createdAt: Date }[],
  payoutCount: number,
): FlowSignals {
  return {
    status,
    reviewerDocsSent: docs.some((d) => d.stage === 'REVIEWER'),
    fundingDocsReceived: hasDealerReturned(docs),
    hasPayouts: payoutCount > 0,
  };
}

export interface WorkStateArgs {
  confirmationStatus: 'PENDING' | 'COMPLETED' | 'ISSUE';
  eligible: boolean; // confirmationEligible(signals)
  checked: number; // confirmationCheckedCount(confirmation)
}

/**
 * The confirmation work-state for a deal, or null when it doesn't belong on the
 * worklist. A flagged issue or a completed call always shows (they're real
 * state); a still-pending call only shows once the deal is eligible.
 */
export function confirmationWorkState(a: WorkStateArgs): ConfirmationWorkState | null {
  if (a.confirmationStatus === 'ISSUE') return 'ISSUE';
  if (a.confirmationStatus === 'COMPLETED') return 'DONE';
  if (!a.eligible) return null;
  return a.checked > 0 ? 'IN_PROGRESS' : 'NEEDS_CALL';
}

/** States that represent outstanding work (the nav badge / header count). */
export const OUTSTANDING_STATES: ConfirmationWorkState[] = ['NEEDS_CALL', 'IN_PROGRESS', 'ISSUE'];

export function isOutstanding(state: ConfirmationWorkState): boolean {
  return OUTSTANDING_STATES.includes(state);
}
