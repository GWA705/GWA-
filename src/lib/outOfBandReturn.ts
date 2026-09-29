import type { ApplicationStatus, DocumentType } from '@prisma/client';
import { PACKAGE_RETURN_FUNDING_TYPES } from './constants';

// Once a deal has reached any of these, its install documents were sent through
// the portal — so a returned package is NOT out-of-band.
export const SENT_OR_BEYOND: ApplicationStatus[] = ['DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];

/**
 * True if install documents were ever sent through the portal for this deal —
 * either the reviewer produced reviewer-stage install docs, or the deal reached
 * DOCS_SENT (or beyond) at some point in its history. A deal that was sent and
 * later moved back to Approved/Conditional still counts as "sent".
 */
export function installDocsEverSent(reviewerDocCount: number, statusHistoryTos: ApplicationStatus[]): boolean {
  return reviewerDocCount > 0 || statusHistoryTos.some((s) => SENT_OR_BEYOND.includes(s));
}

/**
 * True only when a signed package came back BEFORE install documents were ever
 * sent through the portal — the out-of-band exception (docs emailed, dealer
 * couldn't log in, etc.). It requires: the deal is still Approved/Conditional,
 * a real package-return document is present, AND install docs were never sent.
 */
export function isOutOfBandReturn(args: {
  status: ApplicationStatus;
  fundingDocTypes: DocumentType[];
  reviewerDocCount: number;
  statusHistoryTos: ApplicationStatus[];
}): boolean {
  if (args.status !== 'APPROVED' && args.status !== 'CONDITIONAL') return false;
  if (installDocsEverSent(args.reviewerDocCount, args.statusHistoryTos)) return false;
  return args.fundingDocTypes.some((t) => PACKAGE_RETURN_FUNDING_TYPES.includes(t));
}
