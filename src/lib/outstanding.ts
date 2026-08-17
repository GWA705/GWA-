import type { ApplicationStatus, DocumentType, ProgramType } from '@prisma/client';
import { fundingDocumentTypesFor } from './constants';

/**
 * Works out, in plain language, what a dealer still has to do on a deal — the
 * "why is this stuck?" answer. Shared by the dealer deal page (a prominent
 * "What's needed from you" card) and the dashboard (an "Action needed" chip),
 * so both always agree. Mirrors the dealer-court statuses the reminder engine
 * nudges on (APPROVED / CONDITIONAL / PROBLEM).
 */

// Statuses where the ball is in the dealer's court.
const DEALER_COURT: ApplicationStatus[] = ['APPROVED', 'CONDITIONAL', 'PROBLEM'];

type DocLite = { type: DocumentType; verifiedAt: Date | null };
type SerialLite = { productLabel: string | null; value: string };

export interface DealerOutstanding {
  hasAction: boolean;
  /** Plain-language to-dos, most important first. */
  items: string[];
  /** True when the funding package is ready to submit (nothing missing). */
  readyToSubmit: boolean;
}

export function dealerOutstanding(app: {
  status: ApplicationStatus;
  programType: ProgramType;
  productsSold: string[];
  requiresSerials: boolean;
  serialNumbers: SerialLite[];
  fundingDocs: DocLite[];
}): DealerOutstanding {
  const none: DealerOutstanding = { hasAction: false, items: [], readyToSubmit: false };
  if (!DEALER_COURT.includes(app.status)) return none;

  const items: string[] = [];

  if (app.status === 'PROBLEM') {
    items.push('Fix the flagged problem (see the messages and review notes below).');
  }

  // Serial numbers, when the finance company requires one per product.
  if (app.requiresSerials && app.productsSold.length > 0) {
    const have = new Map(app.serialNumbers.filter((s) => s.productLabel).map((s) => [s.productLabel, s.value.trim()]));
    const missing = app.productsSold.filter((p) => !(have.get(p) || '').length);
    if (missing.length) {
      items.push(`Add serial number${missing.length === 1 ? '' : 's'} for: ${missing.join(', ')}.`);
    }
  }

  // Required funding documents not yet uploaded.
  const uploaded = new Set(app.fundingDocs.map((d) => d.type));
  const missingDocs = fundingDocumentTypesFor(app.programType).filter(
    (t) => t.required && !uploaded.has(t.type),
  );
  for (const t of missingDocs) items.push(`Upload: ${t.label}.`);

  // When approved/conditional and everything is in, the last step is to submit.
  const readyToSubmit =
    (app.status === 'APPROVED' || app.status === 'CONDITIONAL') && items.length === 0;
  if (readyToSubmit) {
    items.push('Everything is uploaded — submit the funding package to send it to GWA.');
  }

  return { hasAction: items.length > 0, items, readyToSubmit };
}
