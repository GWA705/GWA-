import type { ApplicationStatus, DocumentType, ProgramType, PaymentMethod } from '@prisma/client';
import { fundingDocumentTypesFor } from './constants';
import type { TFunction } from '@/i18n/translator';
import { fundingDocTypeLabel } from './enumLabels';

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

export function dealerOutstanding(
  app: {
    status: ApplicationStatus;
    programType: ProgramType;
    paymentMethod?: PaymentMethod | null;
    isSplitPayment?: boolean;
    productsSold: string[];
    requiresSerials: boolean;
    serialNumbers: SerialLite[];
    fundingDocs: DocLite[];
  },
  t: TFunction,
): DealerOutstanding {
  const none: DealerOutstanding = { hasAction: false, items: [], readyToSubmit: false };
  if (!DEALER_COURT.includes(app.status)) return none;

  const items: string[] = [];

  if (app.status === 'PROBLEM') {
    items.push(t('outstanding.fixProblem'));
  }

  // Serial numbers, when the finance company requires one per product.
  if (app.requiresSerials && app.productsSold.length > 0) {
    const have = new Map(app.serialNumbers.filter((s) => s.productLabel).map((s) => [s.productLabel, s.value.trim()]));
    const missing = app.productsSold.filter((p) => !(have.get(p) || '').length);
    if (missing.length) {
      const key = missing.length === 1 ? 'outstanding.addSerialOne' : 'outstanding.addSerialMany';
      items.push(t(key, { list: missing.join(', ') }));
    }
  }

  // Required funding documents not yet uploaded.
  const uploaded = new Set(app.fundingDocs.map((d) => d.type));
  const missingDocs = fundingDocumentTypesFor(app.programType, {
    paymentMethod: app.paymentMethod,
    isSplitPayment: app.isSplitPayment,
  }).filter((doc) => doc.required && !uploaded.has(doc.type));
  for (const doc of missingDocs) items.push(t('outstanding.upload', { label: fundingDocTypeLabel(t, doc.type) }));

  // When approved/conditional and everything is in, the last step is to submit.
  const readyToSubmit =
    (app.status === 'APPROVED' || app.status === 'CONDITIONAL') && items.length === 0;
  if (readyToSubmit) {
    items.push(t('outstanding.submitReady'));
  }

  return { hasAction: items.length > 0, items, readyToSubmit };
}
