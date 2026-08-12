/**
 * HD dealer-payout calculator — a faithful port of the GHS "HD Payout Calculator"
 * spreadsheet. Given a deal's total sale amount WITH TAX and the province, it
 * returns the dealer EFT payout, applying the national discount chain and the
 * province's tax rate, rounding to cents at each step exactly like the sheet.
 *
 * Verified against the NB example: $4,686.25 @ 15% → $3,838.62.
 *
 * Note: the tax rate algebraically cancels (payout ≈ 81.9125% of the total), so
 * the province only shifts the result by a penny or two via per-step rounding —
 * but we compute per-province to match the sheet to the cent.
 */

// National HD-program rates (confirmed: these do not change by province).
export const PAYOUT_RATES = {
  hdDiscount: 0.13, // "HD DISCOUNT - 13%"
  ibxDiscount: 0.0125, // "HD IBX DISCOUNT - 1.25%"
  hdProgram: 0.04, // "HD PROGRAM - 4%" (of the pre-tax subtotal)
} as const;

// Province sales-tax rates used to strip/re-add tax. NS is 14% (HST reduced
// from 15% on 1 Apr 2025); the other Atlantic provinces remain 15%.
export const PROVINCE_TAX_RATE: Record<string, number> = {
  ON: 0.13,
  NB: 0.15,
  PE: 0.15,
  NL: 0.15,
  NS: 0.14,
  BC: 0.12,
  MB: 0.12,
  SK: 0.11,
  QC: 0.14975,
  AB: 0.05,
  NT: 0.05,
  NU: 0.05,
  YT: 0.05,
};

// Map common full names to codes, so either form works.
const NAME_TO_CODE: Record<string, string> = {
  ONTARIO: 'ON',
  'NEW BRUNSWICK': 'NB',
  'NOVA SCOTIA': 'NS',
  'PRINCE EDWARD ISLAND': 'PE',
  'NEWFOUNDLAND AND LABRADOR': 'NL',
  NEWFOUNDLAND: 'NL',
  'BRITISH COLUMBIA': 'BC',
  MANITOBA: 'MB',
  SASKATCHEWAN: 'SK',
  QUEBEC: 'QC',
  ALBERTA: 'AB',
  'NORTHWEST TERRITORIES': 'NT',
  NUNAVUT: 'NU',
  YUKON: 'YT',
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function provinceCode(province: string | null | undefined): string | null {
  const p = (province || '').trim().toUpperCase();
  if (!p) return null;
  if (PROVINCE_TAX_RATE[p] !== undefined) return p;
  return NAME_TO_CODE[p] ?? null;
}

export interface PayoutBreakdown {
  ok: boolean;
  province: string | null;
  taxRate: number;
  taxRateAssumed: boolean; // true when the province was unknown and ON's rate was used
  totalWithTax: number;
  subtotal: number; // pre-tax
  hdDiscount: number;
  afterHd: number;
  ibxDiscount: number;
  afterIbx: number;
  hdProgram: number; // 4% of the pre-tax subtotal
  netPreTax: number; // afterIbx − hdProgram (the pre-tax payout)
  hst: number; // tax on the net pre-tax payout
  payout: number; // netPreTax + hst — the EFT amount, tax included
  warning?: string;
}

/**
 * Compute the dealer EFT payout from the total sale (with tax) and province.
 * Mirrors the live HD calculator to the cent: strip tax to a pre-tax subtotal,
 * apply the HD (13%), IBX (1.25%) and HD-program (4% of subtotal) deductions on
 * the pre-tax figures, then add the province tax back onto the net.
 * Returns the full breakdown so dealers can see exactly how the payout is built.
 */
export function computeDealerPayout(totalWithTax: number, province: string | null | undefined): PayoutBreakdown {
  const code = provinceCode(province);
  const taxRateAssumed = code === null;
  const taxRate = code ? PROVINCE_TAX_RATE[code] : PROVINCE_TAX_RATE.ON;

  const base: PayoutBreakdown = {
    ok: false,
    province: code,
    taxRate,
    taxRateAssumed,
    totalWithTax,
    subtotal: 0,
    hdDiscount: 0,
    afterHd: 0,
    ibxDiscount: 0,
    afterIbx: 0,
    hdProgram: 0,
    netPreTax: 0,
    hst: 0,
    payout: 0,
  };

  if (!(totalWithTax > 0)) {
    return { ...base, warning: 'Amount must be greater than zero.' };
  }

  const subtotal = round2(totalWithTax / (1 + taxRate));
  const hdDiscount = round2(subtotal * PAYOUT_RATES.hdDiscount);
  const afterHd = round2(subtotal - hdDiscount);
  const ibxDiscount = round2(afterHd * PAYOUT_RATES.ibxDiscount);
  const afterIbx = round2(afterHd - ibxDiscount);
  const hdProgram = round2(subtotal * PAYOUT_RATES.hdProgram); // 4% of the pre-tax subtotal
  const netPreTax = round2(afterIbx - hdProgram);
  const hst = round2(netPreTax * taxRate);
  const payout = round2(netPreTax + hst);

  return {
    ...base,
    ok: true,
    subtotal,
    hdDiscount,
    afterHd,
    ibxDiscount,
    afterIbx,
    hdProgram,
    netPreTax,
    hst,
    payout,
    warning: taxRateAssumed ? `Unknown province “${province}” — used Ontario's 13% rate.` : undefined,
  };
}
