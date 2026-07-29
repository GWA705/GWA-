import type { ApplicationStatus, ConfirmationStatus } from '@prisma/client';

/**
 * Deal progress tracker. Each stage's "done" flag is derived from the actual
 * data for that part of the deal — not just the single status field — so a dot
 * turns green when that step has really happened (docs actually uploaded,
 * confirmation actually completed, a payout actually recorded), and stays green
 * once the deal moves past it.
 */

export interface ProgressSignals {
  status: ApplicationStatus;
  approvedById?: string | null;
  confirmationStatus: ConfirmationStatus;
  hasFundingDocs: boolean;
  hasPayouts: boolean;
}

export interface ProgressStage {
  key: string;
  label: string;
  done: boolean;
}

const APPROVED_OR_BEYOND: ApplicationStatus[] = [
  'APPROVED',
  'CONDITIONAL',
  'FUNDING_SUBMITTED',
  'FUNDING_REVIEW',
  'FUNDED',
];
const FUNDING_OR_BEYOND: ApplicationStatus[] = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];

export function dealProgress(s: ProgressSignals): ProgressStage[] {
  const approved = !!s.approvedById || APPROVED_OR_BEYOND.includes(s.status);
  return [
    { key: 'submitted', label: 'Submitted', done: s.status !== 'DRAFT' },
    { key: 'approved', label: 'Approved', done: approved },
    { key: 'docs', label: 'Docs uploaded', done: s.hasFundingDocs || FUNDING_OR_BEYOND.includes(s.status) },
    { key: 'confirmation', label: 'Confirmation', done: s.confirmationStatus === 'COMPLETED' },
    { key: 'funding', label: 'In for funding', done: ['FUNDING_REVIEW', 'FUNDED'].includes(s.status) },
    { key: 'funded', label: 'Funded', done: s.status === 'FUNDED' },
    { key: 'paid', label: 'Paid', done: s.hasPayouts },
  ];
}
