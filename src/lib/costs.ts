import { getSettings, setSetting } from './settings';
import { API_SERVICES, usageForMonth, monthKey } from './apiUsage';

/**
 * Outside-service cost total for the admin Costs page.
 *
 * Two kinds of cost are combined:
 *  - USAGE-BASED: the Google address-lookup API. The portal meters every call
 *    (see apiUsage.ts); here we price this month's calls at editable per-1,000
 *    rates. This is the only cost that moves with usage.
 *  - FIXED MONTHLY: AWS hosting (the app runs on Elastic Beanstalk — a single
 *    8 GB t3 EC2 instance + its disk — behind CloudFront + WAF), AWS storage/db,
 *    email, and domain. These don't change with usage and can't be pulled without
 *    wiring in the providers' billing accounts, so an admin enters their actual
 *    bill amounts. Sensible starting estimates are pre-filled and flagged as such.
 *    (Render is gone — the portal was migrated off it; see docs/CHANGELOG.md.)
 *
 * All money is handled in dollars (numbers). Every rate/amount is stored in
 * AppSetting so it's editable without a redeploy.
 */

export const COST_KEYS = {
  // Google per-1,000-request rates (editable estimates).
  googleAutocompletePer1000: 'cost.googleAutocompletePer1000',
  googleDetailsPer1000: 'cost.googleDetailsPer1000',
  googleFreeCredit: 'cost.googleFreeCredit', // monthly free credit applied to Google, if any
  // Fixed monthly AWS + service bills.
  awsCompute: 'cost.awsCompute', // Elastic Beanstalk EC2 (8 GB) + its EBS disk
  awsCloudfront: 'cost.awsCloudfront', // CloudFront CDN + WAF web ACL
  awsS3: 'cost.awsS3',
  awsRds: 'cost.awsRds',
  email: 'cost.email',
  domain: 'cost.domain',
  // Metered services (AI, Twilio) bill in USD; this rate folds them into the CAD total.
  usdToCad: 'cost.usdToCad',
} as const;

// Starting estimates. These are guesses to give an immediate ballpark — the
// admin replaces them with real figures. Google rates reflect standard published
// list prices (per 1,000 requests) at the time of writing. AWS figures reflect
// the current setup: a single on-demand 8 GB t3 instance (t3.large) + 50 GB gp3
// in ca-central-1, CloudFront + a WAF web ACL, S3, and a single-AZ RDS instance.
// These are ballpark — confirm the hosting line against the real AWS bill.
export const COST_DEFAULTS: Record<string, number> = {
  [COST_KEYS.googleAutocompletePer1000]: 2.83,
  [COST_KEYS.googleDetailsPer1000]: 17.0,
  [COST_KEYS.googleFreeCredit]: 0,
  [COST_KEYS.awsCompute]: 73, // ~$68 t3.large (8 GB) on-demand + ~$5 for 50 GB gp3
  [COST_KEYS.awsCloudfront]: 8, // ~$5 WAF web ACL + CloudFront usage
  [COST_KEYS.awsS3]: 5,
  [COST_KEYS.awsRds]: 30,
  [COST_KEYS.email]: 0,
  [COST_KEYS.domain]: 2,
  [COST_KEYS.usdToCad]: 1.37,
};

export interface CostConfig {
  googleAutocompletePer1000: number;
  googleDetailsPer1000: number;
  googleFreeCredit: number;
  awsCompute: number;
  awsCloudfront: number;
  awsS3: number;
  awsRds: number;
  email: number;
  domain: number;
  usdToCad: number;
}

function num(v: string | null, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Read the cost config, falling back to the starting estimates. */
export async function getCostConfig(): Promise<CostConfig> {
  const s = await getSettings(Object.values(COST_KEYS));
  const g = (k: keyof typeof COST_KEYS) => num(s[COST_KEYS[k]], COST_DEFAULTS[COST_KEYS[k]]);
  return {
    googleAutocompletePer1000: g('googleAutocompletePer1000'),
    googleDetailsPer1000: g('googleDetailsPer1000'),
    googleFreeCredit: g('googleFreeCredit'),
    awsCompute: g('awsCompute'),
    awsCloudfront: g('awsCloudfront'),
    awsS3: g('awsS3'),
    awsRds: g('awsRds'),
    email: g('email'),
    domain: g('domain'),
    usdToCad: g('usdToCad'),
  };
}

/** Save the cost config (only writes the keys provided). */
export async function saveCostConfig(patch: Partial<CostConfig>): Promise<void> {
  const map: [keyof CostConfig, string][] = [
    ['googleAutocompletePer1000', COST_KEYS.googleAutocompletePer1000],
    ['googleDetailsPer1000', COST_KEYS.googleDetailsPer1000],
    ['googleFreeCredit', COST_KEYS.googleFreeCredit],
    ['awsCompute', COST_KEYS.awsCompute],
    ['awsCloudfront', COST_KEYS.awsCloudfront],
    ['awsS3', COST_KEYS.awsS3],
    ['awsRds', COST_KEYS.awsRds],
    ['email', COST_KEYS.email],
    ['domain', COST_KEYS.domain],
    ['usdToCad', COST_KEYS.usdToCad],
  ];
  for (const [field, key] of map) {
    const v = patch[field];
    if (v !== undefined) await setSetting(key, String(v));
  }
}

export interface CostLine {
  label: string;
  detail: string; // e.g. "1,240 calls × $2.83/1,000"
  amount: number;
  usageBased: boolean;
}

export interface CostBreakdown {
  month: string; // 'YYYY-MM'
  google: {
    autocompleteCalls: number;
    detailsCalls: number;
    grossCost: number; // before free credit
    freeCredit: number;
    netCost: number; // after free credit (never below 0)
  };
  lines: CostLine[]; // every line that makes up the total, in display order
  total: number;
}

/** Round to cents. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a USD amount to CAD at the configured rate, rounded to cents. */
export function usdToCadAmount(usd: number, usdToCad: number): number {
  return cents(usd * usdToCad);
}

/**
 * Convert an amount in its own currency to CAD for the combined total: CAD stays
 * as-is; USD (and anything else, as a best guess) is multiplied by the rate.
 */
export function amountInCad(amount: number, currency: string, usdToCad: number): number {
  return currency.toUpperCase() === 'CAD' ? cents(amount) : cents(amount * usdToCad);
}

/**
 * Compute the full monthly cost breakdown: this month's metered Google usage
 * priced at the configured rates, plus the fixed monthly bills, and the total.
 */
export async function computeMonthlyCosts(
  cfg: CostConfig,
  month: string = monthKey(),
): Promise<CostBreakdown> {
  const usage = await usageForMonth(month);
  return buildBreakdown(
    cfg,
    usage.counts[API_SERVICES.googleAutocomplete] ?? 0,
    usage.counts[API_SERVICES.googleDetails] ?? 0,
    month,
  );
}

/**
 * Pure pricing of a month from its two call counts + the config. Split out from
 * the DB read so the money math is unit-testable.
 */
export function buildBreakdown(
  cfg: CostConfig,
  autocompleteCalls: number,
  detailsCalls: number,
  month: string,
): CostBreakdown {
  const acCost = cents((autocompleteCalls / 1000) * cfg.googleAutocompletePer1000);
  const detCost = cents((detailsCalls / 1000) * cfg.googleDetailsPer1000);
  const grossGoogle = cents(acCost + detCost);
  const freeCredit = Math.min(cfg.googleFreeCredit, grossGoogle);
  const netGoogle = cents(Math.max(0, grossGoogle - freeCredit));

  const fmtCalls = (n: number) => n.toLocaleString('en-CA');
  const lines: CostLine[] = [
    {
      label: 'Google address lookups — autocomplete',
      detail: `${fmtCalls(autocompleteCalls)} calls × $${cfg.googleAutocompletePer1000.toFixed(2)}/1,000`,
      amount: acCost,
      usageBased: true,
    },
    {
      label: 'Google address lookups — details',
      detail: `${fmtCalls(detailsCalls)} calls × $${cfg.googleDetailsPer1000.toFixed(2)}/1,000`,
      amount: detCost,
      usageBased: true,
    },
  ];
  if (freeCredit > 0) {
    lines.push({ label: 'Google free credit', detail: 'Applied to Google usage', amount: -freeCredit, usageBased: true });
  }
  lines.push(
    { label: 'AWS — app hosting (EC2 8 GB + 50 GB disk)', detail: 'Fixed monthly', amount: cents(cfg.awsCompute), usageBased: false },
    { label: 'AWS — CloudFront CDN + WAF', detail: 'Fixed monthly (estimate)', amount: cents(cfg.awsCloudfront), usageBased: false },
    { label: 'AWS — S3 document storage', detail: 'Fixed monthly (estimate)', amount: cents(cfg.awsS3), usageBased: false },
    { label: 'AWS — RDS database (ca-central-1)', detail: 'Fixed monthly (estimate)', amount: cents(cfg.awsRds), usageBased: false },
    { label: 'Email (SMTP)', detail: 'Fixed monthly', amount: cents(cfg.email), usageBased: false },
    { label: 'Domain / DNS', detail: 'Fixed monthly', amount: cents(cfg.domain), usageBased: false },
  );

  const total = cents(lines.reduce((s, l) => s + l.amount, 0));

  return {
    month,
    google: {
      autocompleteCalls,
      detailsCalls,
      grossCost: grossGoogle,
      freeCredit,
      netCost: netGoogle,
    },
    lines,
    total,
  };
}
