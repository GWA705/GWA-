import type { ApplicationStatus } from '@prisma/client';

/**
 * Why hasn't a deal with its signed package back moved on to funding?
 *
 * The dealer's "Submit funding package" action (submitFundingAction) only fires
 * when the deal is DOCS_SENT and, if the finance company requires it, a serial
 * number is present for EVERY product. When a serial is missing, pressing Submit
 * silently does nothing — so the deal sits at "Documents sent" with no clue why.
 *
 * This computes a plain-language explanation for the REVIEWER so the hold-up is
 * visible on the deal instead of a mystery. It mirrors the dealer-side gate
 * exactly (same serial rule as productSerialsComplete). Pure + no DB so it can
 * be unit-tested.
 */

export interface FundingSubmitInput {
  status: ApplicationStatus;
  requiresSerialPerProduct: boolean;
  productsSold: string[];
  /** Product labels that currently have a non-empty serial number. */
  serialProductLabels: string[];
  /** The dealer has sent signed documents back since the install docs went out. */
  hasReturnedDocs: boolean;
}

export interface FundingSubmitDiagnosis {
  show: boolean;
  missingSerialProducts: string[];
  title: string;
  detail: string;
}

const NONE: FundingSubmitDiagnosis = { show: false, missingSerialProducts: [], title: '', detail: '' };

export function diagnoseFundingSubmit(input: FundingSubmitInput): FundingSubmitDiagnosis {
  // Only relevant while the deal is still "Documents sent" — once it's moved to
  // funding there's nothing stuck to explain.
  if (input.status !== 'DOCS_SENT') return NONE;

  const have = new Set(input.serialProductLabels.map((s) => s.trim()).filter(Boolean));
  const missingSerialProducts = input.requiresSerialPerProduct
    ? input.productsSold.map((p) => p.trim()).filter((p) => p && !have.has(p))
    : [];

  if (missingSerialProducts.length > 0) {
    const list = missingSerialProducts.join(', ');
    return {
      show: true,
      missingSerialProducts,
      title: 'The dealer can’t submit the funding package yet',
      detail:
        `This deal’s finance company requires a serial number for every product, and one is still missing for: ${list}. ` +
        'Until it’s added, the dealer’s “Submit funding package” button silently does nothing — which is why the deal is stuck at “Documents sent.” ' +
        'Add the serial number here, or ask the dealer to add it, then move the deal to In for funding.',
    };
  }

  if (input.hasReturnedDocs) {
    return {
      show: true,
      missingSerialProducts: [],
      title: 'Signed package is in — but the deal was never submitted for funding',
      detail:
        'The dealer uploaded the signed documents but didn’t press “Submit funding package,” so the deal stayed at “Documents sent” instead of moving to “Submitted to finance company.” ' +
        'Everything required is here — use “Move to In for funding” to continue, or ask the dealer to submit.',
    };
  }

  return NONE;
}
