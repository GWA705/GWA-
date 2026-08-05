import type { Province } from '@prisma/client';

/**
 * First Nations (status) tax exemption. Two independent layers apply, and which
 * ones depend on where the goods are delivered/installed:
 *
 *  - Federal GST (5%): relieved only when the vendor delivers to a reserve
 *    (Indian Act s.87). Off-reserve, GST is charged.
 *  - Provincial portion: in Ontario, a status card gets a point-of-sale rebate
 *    of the 8% provincial part of HST even off-reserve.
 *
 * So an off-reserve Ontario deal is a PARTIAL exemption (provincial only) and an
 * on-reserve deal is FULL. Other provinces have their own rules we haven't
 * encoded yet — those return NEEDS_REVIEW so a reviewer handles them by hand.
 * v1 flags and captures; it does not compute dollar amounts.
 */

export type ExemptionType = 'NONE' | 'FULL' | 'PROVINCIAL_ONLY' | 'NEEDS_REVIEW';

export interface ExemptionInput {
  taxExempt: boolean;
  province: Province;
  deliveredToReserve: boolean;
}

export interface ExemptionSummary {
  type: ExemptionType;
  label: string; // short badge text
  detail: string; // one-line explanation for the reviewer
}

// Provinces whose status-holder point-of-sale rules we've encoded. Ontario gives
// the 8% provincial rebate at point of sale; extend this as others are added.
const PROVINCIAL_POS_REBATE: Partial<Record<Province, { label: string; rate: string }>> = {
  ON: { label: 'Ontario 8% point-of-sale rebate', rate: '8%' },
};

export function exemptionSummary(input: ExemptionInput): ExemptionSummary {
  if (!input.taxExempt) {
    return { type: 'NONE', label: 'Taxable', detail: 'No tax exemption on this deal.' };
  }
  if (input.deliveredToReserve) {
    return {
      type: 'FULL',
      label: 'Full exemption',
      detail: 'Delivered to a reserve — both GST and the provincial portion are relieved (Indian Act s.87).',
    };
  }
  const prov = PROVINCIAL_POS_REBATE[input.province];
  if (prov) {
    return {
      type: 'PROVINCIAL_ONLY',
      label: 'Provincial portion only',
      detail: `Off-reserve in ${input.province}: ${prov.label} applies; the 5% federal GST is still charged.`,
    };
  }
  return {
    type: 'NEEDS_REVIEW',
    label: 'Exemption — needs review',
    detail: `Off-reserve in ${input.province}: provincial rules not yet encoded — confirm the correct treatment by hand.`,
  };
}
