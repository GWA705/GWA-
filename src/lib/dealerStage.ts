import type { ApplicationStatus } from '@prisma/client';

/**
 * Dealer-facing pipeline model for the Applications views (Tracker / Pipeline /
 * Progress). Maps a deal's status to a stage (for the board columns and the
 * progress bar) and to an action group (for the tracker sections). Kept in one
 * place so every view agrees on where a deal sits.
 */

export type DealStageKey = 'submitted' | 'approved' | 'docs' | 'funded';
export type DealGroup = 'action' | 'progress' | 'done' | 'closed';

export interface DealStage {
  index: number; // 0..3 — column position
  key: DealStageKey;
  label: string;
  pct: number; // 0..100 — progress bar fill
}

/** The four pipeline columns, in order. */
export const DEAL_COLUMNS: { key: DealStageKey; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'docs', label: 'Docs & funding' },
  { key: 'funded', label: 'Funded / Paid' },
];

export function dealStage(status: ApplicationStatus, isPaid: boolean): DealStage {
  if (isPaid) return { index: 3, key: 'funded', label: 'Funded & paid', pct: 100 };
  switch (status) {
    case 'DRAFT': return { index: 0, key: 'submitted', label: 'Draft', pct: 5 };
    case 'SUBMITTED': return { index: 0, key: 'submitted', label: 'Submitted', pct: 12 };
    case 'UNDER_REVIEW': return { index: 0, key: 'submitted', label: 'Under review', pct: 22 };
    case 'CONDITIONAL': return { index: 1, key: 'approved', label: 'Conditionally approved', pct: 38 };
    case 'APPROVED': return { index: 1, key: 'approved', label: 'Approved', pct: 46 };
    case 'PROBLEM': return { index: 1, key: 'approved', label: 'Problem — needs attention', pct: 40 };
    case 'DOCS_SENT': return { index: 2, key: 'docs', label: 'Documents sent', pct: 58 };
    case 'FUNDING_SUBMITTED': return { index: 2, key: 'docs', label: 'Funding submitted', pct: 72 };
    case 'FUNDING_REVIEW': return { index: 2, key: 'docs', label: 'In funding review', pct: 84 };
    case 'FUNDED': return { index: 3, key: 'funded', label: 'Funded', pct: 95 };
    case 'DECLINED': return { index: 0, key: 'submitted', label: 'Declined', pct: 0 };
    case 'WITHDRAWN': return { index: 0, key: 'submitted', label: 'Withdrawn', pct: 0 };
    default: return { index: 0, key: 'submitted', label: String(status), pct: 10 };
  }
}

/** Which tracker section a deal belongs to. `hasAction` comes from dealerOutstanding. */
export function dealGroup(status: ApplicationStatus, isPaid: boolean, hasAction: boolean): DealGroup {
  if (status === 'DECLINED' || status === 'WITHDRAWN') return 'closed';
  if (isPaid || status === 'FUNDED') return 'done';
  if (hasAction || status === 'PROBLEM') return 'action';
  return 'progress';
}

export const DEAL_GROUPS: { key: DealGroup; label: string; blurb: string }[] = [
  { key: 'action', label: 'Needs your action', blurb: 'Upload documents, add details, or resolve a flagged problem.' },
  { key: 'progress', label: 'In progress — with GWA', blurb: 'Submitted and moving through review and funding.' },
  { key: 'done', label: 'Funded & paid', blurb: 'Complete — funds released.' },
  { key: 'closed', label: 'Closed', blurb: 'Declined or withdrawn.' },
];
