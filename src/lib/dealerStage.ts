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
  /** i18n key under `deal.stage.*` for the localized label. */
  labelKey: string;
  pct: number; // 0..100 — progress bar fill
}

/** The four pipeline columns, in order. Labels localized via `deal.column.<key>`. */
export const DEAL_COLUMNS: { key: DealStageKey; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'docs', label: 'Docs & funding' },
  { key: 'funded', label: 'Funded / Paid' },
];

export function dealStage(status: ApplicationStatus, isPaid: boolean): DealStage {
  const k = (key: DealStageKey, index: number, label: string, labelKey: string, pct: number): DealStage =>
    ({ key, index, label, labelKey: `deal.stage.${labelKey}`, pct });
  if (isPaid) return k('funded', 3, 'Funded & paid', 'fundedPaid', 100);
  switch (status) {
    case 'DRAFT': return k('submitted', 0, 'Draft', 'draft', 5);
    case 'SUBMITTED': return k('submitted', 0, 'Submitted', 'submitted', 12);
    case 'UNDER_REVIEW': return k('submitted', 0, 'Under review', 'underReview', 22);
    case 'CONDITIONAL': return k('approved', 1, 'Conditionally approved', 'conditional', 38);
    case 'APPROVED': return k('approved', 1, 'Approved', 'approved', 46);
    case 'PROBLEM': return k('approved', 1, 'Problem — needs attention', 'problem', 40);
    case 'DOCS_SENT': return k('docs', 2, 'Documents sent', 'docsSent', 58);
    case 'FUNDING_SUBMITTED': return k('docs', 2, 'Funding submitted', 'fundingSubmitted', 72);
    case 'FUNDING_REVIEW': return k('docs', 2, 'In funding review', 'fundingReview', 84);
    case 'FUNDED': return k('funded', 3, 'Funded', 'funded', 95);
    case 'DECLINED': return k('submitted', 0, 'Declined', 'declined', 0);
    case 'WITHDRAWN': return k('submitted', 0, 'Withdrawn', 'withdrawn', 0);
    default: return { index: 0, key: 'submitted', label: String(status), labelKey: `deal.stage.${status}`, pct: 10 };
  }
}

/** Which tracker section a deal belongs to. `hasAction` comes from dealerOutstanding. */
export function dealGroup(status: ApplicationStatus, isPaid: boolean, hasAction: boolean): DealGroup {
  if (status === 'DECLINED' || status === 'WITHDRAWN') return 'closed';
  if (isPaid || status === 'FUNDED') return 'done';
  if (hasAction || status === 'PROBLEM') return 'action';
  return 'progress';
}

// Labels/blurbs localized via `deal.group.<key>` / `deal.group.<key>Blurb`.
export const DEAL_GROUPS: { key: DealGroup; label: string; blurb: string }[] = [
  { key: 'action', label: 'Needs your action', blurb: 'Upload documents, add details, or resolve a flagged problem.' },
  { key: 'progress', label: 'In progress — with Georgian Water & Air', blurb: 'Submitted and moving through review and funding.' },
  { key: 'done', label: 'Funded & paid', blurb: 'Complete — funds released.' },
  { key: 'closed', label: 'Closed', blurb: 'Declined or withdrawn.' },
];
