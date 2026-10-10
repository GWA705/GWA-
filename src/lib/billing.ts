import { getSettings, setSetting } from './settings';

/**
 * Mail-in lead billing rates. Georgian Water & Air bills each office for the
 * leads GW uploaded on their behalf (mailed to our office): a per-lead rate plus
 * a per-envelope mailing charge, with an optional HST rate. All editable in Admin
 * → Mail-in billing (stored in AppSetting, no redeploy).
 */

export const BILLING_KEYS = {
  leadRate: 'billing.leadRate',
  envelopeRate: 'billing.envelopeRate',
  hstPercent: 'billing.hstPercent',
} as const;

export const BILLING_DEFAULTS = {
  leadRate: 5, // $ per billable lead
  envelopeRate: 2, // $ per envelope (mailing)
  hstPercent: 0, // off by default; set it (e.g. 13 for ON) to add an HST line
};

export interface BillingConfig {
  leadRate: number;
  envelopeRate: number;
  hstPercent: number;
}

function num(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const s = await getSettings(Object.values(BILLING_KEYS));
  return {
    leadRate: num(s[BILLING_KEYS.leadRate], BILLING_DEFAULTS.leadRate),
    envelopeRate: num(s[BILLING_KEYS.envelopeRate], BILLING_DEFAULTS.envelopeRate),
    hstPercent: num(s[BILLING_KEYS.hstPercent], BILLING_DEFAULTS.hstPercent),
  };
}

export async function saveBillingConfig(patch: Partial<BillingConfig>): Promise<void> {
  const map: [keyof BillingConfig, string][] = [
    ['leadRate', BILLING_KEYS.leadRate],
    ['envelopeRate', BILLING_KEYS.envelopeRate],
    ['hstPercent', BILLING_KEYS.hstPercent],
  ];
  for (const [field, key] of map) {
    const v = patch[field];
    if (v !== undefined) await setSetting(key, String(v));
  }
}

export { computeInvoice, money, type InvoiceAmounts, type BillingRates } from './billingMath';
