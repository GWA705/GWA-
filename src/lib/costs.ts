import { getSettings, setSetting } from './settings';
import { API_SERVICES, usageForMonth, monthKey } from './apiUsage';

/**
 * Outside-service cost total for the admin Costs page.
 *
 * Two kinds of cost are combined:
 *  - USAGE-BASED: the Google address-lookup API. The portal meters every call
 *    (see apiUsage.ts); here we price this month's calls at editable per-1,000
 *    rates. This is the only cost that moves with usage.
 *  - FIXED MONTHLY: Render hosting, AWS storage/database, email, and domain.
 *    These don't change with usage and can't be pulled without wiring in the
 *    providers' billing accounts, so an admin enters their actual bill amounts.
 *    Sensible starting estimates are pre-filled and clearly flagged as such.
 *
 * All money is handled in dollars (numbers). Every rate/amount is stored in
 * AppSetting so it's editable without a redeploy.
 */

export const COST_KEYS = {
  // Google per-1,000-request rates (editable estimates).
  googleAutocompletePer1000: 'cost.googleAutocompletePer1000',
  googleDetailsPer1000: 'cost.googleDetailsPer1000',
  googleFreeCredit: 'cost.googleFreeCredit', // monthly free credit applied to Google, if any
  // Fixed monthly bills.
  render: 'cost.render',
  awsS3: 'cost.awsS3',
  awsRds: 'cost.awsRds',
  email: 'cost.email',
  domain: 'cost.domain',
} as const;

// Starting estimates. These are guesses to give an immediate ballpark — the
// admin replaces them with real figures. Google rates reflect standard published
// list prices (per 1,000 requests) at the time of writing.
export const COST_DEFAULTS: Record<string, number> = {
  [COST_KEYS.googleAutocompletePer1000]: 2.83,
  [COST_KEYS.googleDetailsPer1000]: 17.0,
  [COST_KEYS.googleFreeCredit]: 0,
  [COST_KEYS.render]: 25,
  [COST_KEYS.awsS3]: 5,
  [COST_KEYS.awsRds]: 30,
  [COST_KEYS.email]: 0,
  [COST_KEYS.domain]: 2,
};

export interface CostConfig {
  googleAutocompletePer1000: number;
  googleDetailsPer1000: number;
  googleFreeCredit: number;
  render: number;
  awsS3: number;
  awsRds: number;
  email: number;
  domain: number;
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
    render: g('render'),
    awsS3: g('awsS3'),
    awsRds: g('awsRds'),
    email: g('email'),
    domain: g('domain'),
  };
}

/** Save the cost config (only writes the keys provided). */
export async function saveCostConfig(patch: Partial<CostConfig>): Promise<void> {
  const map: [keyof CostConfig, string][] = [
    ['googleAutocompletePer1000', COST_KEYS.googleAutocompletePer1000],
    ['googleDetailsPer1000', COST_KEYS.googleDetailsPer1000],
    ['googleFreeCredit', COST_KEYS.googleFreeCredit],
    ['render', COST_KEYS.render],
    ['awsS3', COST_KEYS.awsS3],
    ['awsRds', COST_KEYS.awsRds],
    ['email', COST_KEYS.email],
    ['domain', COST_KEYS.domain],
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
    { label: 'Render hosting', detail: 'Fixed monthly', amount: cents(cfg.render), usageBased: false },
    { label: 'AWS — S3 document storage', detail: 'Fixed monthly (estimate)', amount: cents(cfg.awsS3), usageBased: false },
    { label: 'AWS — RDS database (Canada)', detail: 'Fixed monthly (estimate)', amount: cents(cfg.awsRds), usageBased: false },
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
