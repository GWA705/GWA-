import 'server-only';

/**
 * Minimal Anthropic Messages API client (via fetch — no SDK dependency) used for
 * the dealer support-chat assistant. Configured with ANTHROPIC_API_KEY in Render;
 * when unset, callers fall back to the static after-hours notice.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
// Fast + inexpensive, well-suited to a high-volume support chat. Override with
// ANTHROPIC_MODEL if a more capable model is wanted.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
}

// What the assistant knows about the portal, so answers are grounded rather than
// guessed. Kept short and factual; capabilities mirror the dealer nav.
const PORTAL_FACTS = `Georgian Water & Air runs a Dealer Portal where dealers:
- start and track credit applications for customers ("New customer" / Applications; statuses: Pending, Approved, Declined);
- manage Home Depot (HD) leads and see them on a map;
- order gear and materials in the Marketplace;
- request Water-test gift cards;
- read the Product library, HD Promotions and HD Credit Card info, and Resources;
- use the HD Payout calculator;
- view Reports (monthly performance, weekly store detail; owners also get product pricing, sales reps, custom, forecast, accounting);
- chat with the Georgian Water & Air team (this chat).`;

function systemPrompt(locale: 'en' | 'fr'): string {
  const lang = locale === 'fr' ? 'Canadian French (fr-CA)' : 'English';
  return `You are the support assistant inside the Georgian Water & Air Dealer Portal, helping dealers (Home Depot water-treatment sales reps) use the portal and answer product/process questions.

${PORTAL_FACTS}

Rules:
- Reply in ${lang}. Keep it short and friendly — usually 1-4 sentences.
- Always call the company "Georgian Water & Air" (never "GWA" alone or "Georgian Water").
- Help with how-to, navigation, product and general process questions.
- You do NOT have access to any specific customer, application, deal, dollar figure, credit decision, approval status, or timeline. Never invent or guess these.
- If you don't know the answer, aren't sure it's correct, or it needs a specific/binding answer you can't verify, do NOT guess. Say something like: "I'm not certain on that — let me find someone on the Georgian Water & Air team who can help." Keep it warm and brief. A real teammate can jump into this same chat anytime.
- Never promise approvals, pricing, payouts, or anything binding, and don't state policy you're not sure of.
- Don't ask for or repeat full credit card numbers or SIN/SSN.`;
}

/**
 * Generate a support reply from recent conversation turns. Returns null on any
 * failure (missing key, API error, empty output) so the caller can fall back.
 */
export async function generateSupportReply(turns: AiTurn[], locale: 'en' | 'fr'): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  // Trim to the most recent turns and ensure the first is a user turn (the API
  // requires the messages to start with 'user').
  let msgs = turns.slice(-12);
  while (msgs.length && msgs[0].role !== 'user') msgs = msgs.slice(1);
  if (msgs.length === 0) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 500,
        system: systemPrompt(locale),
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text!.trim())
      .join('\n')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
