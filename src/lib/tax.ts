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

/**
 * Combined retail sales-tax rate by province, used to back the pre-tax "net" out
 * of a tax-included sale total for Home Depot paperwork. HST provinces are the
 * single HST rate; GST + PST/QST provinces use the standard combined rate; the
 * territories and Alberta are GST-only (5%). Rates as of 2026 (NS HST is 14%
 * since Apr 2025). If a provincial rate changes, update it here. This is the
 * standard rate — a status-card exemption (see exemptionSummary) is separate.
 */
export const SALES_TAX_RATE: Record<Province, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.14,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

export function taxRateFor(province: Province | null | undefined): number {
  return province ? SALES_TAX_RATE[province] ?? 0 : 0;
}

export interface NetBreakdown {
  rate: number; // e.g. 0.13
  ratePct: number; // e.g. 13 (or 14.975)
  tax: number; // dollars of tax in the total
  net: number; // pre-tax amount
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Split a tax-INCLUDED total into its pre-tax net and the tax portion, using the
 * province's rate. With no known rate, net = total and tax = 0.
 */
export function netBeforeTax(total: number, province: Province | null | undefined): NetBreakdown {
  const rate = taxRateFor(province);
  const net = rate > 0 ? total / (1 + rate) : total;
  return {
    rate,
    ratePct: Number((rate * 100).toFixed(3)),
    net: round2(net),
    tax: round2(total - net),
  };
}
