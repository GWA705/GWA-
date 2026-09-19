import { prisma } from './db';
import { dayKey, monthKey } from './apiUsage';

/**
 * Measured Anthropic API usage, so the System health page can show REAL AI spend
 * for the month instead of an estimate. The two AI features in the portal — the
 * lead-card reader and the dealer support assistant — each call recordAiUsage()
 * after every successful call with the token counts the API returns. Rows are
 * kept per service + model + UTC day (see the AiUsage model).
 *
 * Best-effort: metering must never break the underlying feature, so recordAiUsage
 * swallows its own errors. Metering starts the day this ships — there's no history
 * before then (the Anthropic Console has the full billing history).
 */

export const AI_SERVICES = {
  cardScan: 'ai_card_scan',
  assistant: 'ai_assistant',
} as const;

export type AiService = (typeof AI_SERVICES)[keyof typeof AI_SERVICES];

const SERVICE_LABELS: Record<string, string> = {
  [AI_SERVICES.cardScan]: 'Lead-card reader',
  [AI_SERVICES.assistant]: 'Support assistant',
};

/**
 * Anthropic first-party API rates, USD per 1,000,000 tokens. Keep in sync with
 * the models the portal actually calls (the card reader defaults to Opus 5; the
 * assistant to Sonnet 5). An unrecognised model is priced at the fallback and
 * flagged, so a model swap never silently reports $0.
 */
export const MODEL_RATES: Record<string, { in: number; out: number }> = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
// Used when a model id isn't in the table (priced as Sonnet-tier, clearly a guess).
const FALLBACK_RATE = { in: 2, out: 10 };

/** USD cost of a token count on a given model. */
export function priceUsd(model: string, inputTokens: number, outputTokens: number): number {
  const r = MODEL_RATES[model] ?? FALLBACK_RATE;
  return (inputTokens / 1_000_000) * r.in + (outputTokens / 1_000_000) * r.out;
}

/** Record one AI call's token usage. Fire-and-forget — never throws to the caller. */
export async function recordAiUsage(input: {
  service: AiService;
  model: string;
  inputTokens: number;
  outputTokens: number;
  when?: Date;
}): Promise<void> {
  const day = dayKey(input.when ?? new Date());
  const model = (input.model || 'unknown').trim() || 'unknown';
  const inTok = Math.max(0, Math.round(input.inputTokens || 0));
  const outTok = Math.max(0, Math.round(input.outputTokens || 0));
  try {
    await prisma.aiUsage.upsert({
      where: { service_model_day: { service: input.service, model, day } },
      create: { service: input.service, model, day, calls: 1, inputTokens: inTok, outputTokens: outTok },
      update: { calls: { increment: 1 }, inputTokens: { increment: inTok }, outputTokens: { increment: outTok } },
    });
  } catch (err) {
    console.error('[aiUsage] failed to record', input.service, err);
  }
}

export interface AiUsageLine {
  service: string;
  label: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface AiUsageModelLine {
  model: string;
  known: boolean; // false when the model id isn't in MODEL_RATES (cost is a guess)
  calls: number;
  costUsd: number;
}

export interface AiUsageSummary {
  month: string; // 'YYYY-MM'
  hasData: boolean;
  byService: AiUsageLine[]; // one per service that has usage this month
  byModel: AiUsageModelLine[];
  totals: { calls: number; inputTokens: number; outputTokens: number; costUsd: number };
}

/**
 * This month's measured AI usage, aggregated and priced. Pure read — safe to call
 * from a server component. USD, matching how Anthropic bills.
 */
export async function aiUsageForMonth(month: string = monthKey()): Promise<AiUsageSummary> {
  const rows = await prisma.aiUsage.findMany({ where: { day: { startsWith: month } } });

  const svc = new Map<string, AiUsageLine>();
  const mdl = new Map<string, AiUsageModelLine>();
  const totals = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };

  for (const r of rows) {
    const cost = priceUsd(r.model, r.inputTokens, r.outputTokens);

    const s = svc.get(r.service) ?? {
      service: r.service,
      label: SERVICE_LABELS[r.service] ?? r.service,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
    s.calls += r.calls;
    s.inputTokens += r.inputTokens;
    s.outputTokens += r.outputTokens;
    s.costUsd += cost;
    svc.set(r.service, s);

    const m = mdl.get(r.model) ?? { model: r.model, known: r.model in MODEL_RATES, calls: 0, costUsd: 0 };
    m.calls += r.calls;
    m.costUsd += cost;
    mdl.set(r.model, m);

    totals.calls += r.calls;
    totals.inputTokens += r.inputTokens;
    totals.outputTokens += r.outputTokens;
    totals.costUsd += cost;
  }

  const byService = [...svc.values()].sort((a, b) => b.costUsd - a.costUsd);
  const byModel = [...mdl.values()].sort((a, b) => b.costUsd - a.costUsd);
  return { month, hasData: rows.length > 0, byService, byModel, totals };
}
