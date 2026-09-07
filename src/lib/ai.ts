import 'server-only';

/**
 * Minimal Anthropic Messages API client (via fetch — no SDK dependency) used for
 * the dealer support-chat assistant. Configured with ANTHROPIC_API_KEY in Render;
 * when unset, callers fall back to the static after-hours notice.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
// Sonnet 5: sharp, high-quality answers for the support chat, still inexpensive.
// Override with ANTHROPIC_MODEL (e.g. claude-haiku-4-5 to cut cost, or
// claude-opus-5 for maximum capability).
const DEFAULT_MODEL = 'claude-sonnet-5';

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
}

// What the assistant knows about the portal, so answers are grounded rather than
// guessed. Kept short and factual; capabilities mirror the dealer nav.
const PORTAL_FACTS = `Georgian Water & Air is a Home Depot water-treatment provider (Barrie, Ontario). Dealers are Home Depot sales reps who sell water treatment and book installs. The Dealer Portal is where they:
- Start and track customer CREDIT APPLICATIONS: "New customer" opens the application form; "Applications" (a.k.a. Deals) lists them with a status of Pending (submitted, under review), Approved, or Declined. The reviewer team processes submitted applications.
- Manage HOME DEPOT (HD) LEADS: leads appear under "Leads" and on a map; the dealer works them (New → Working → Booked & sold, or No-good).
- Order equipment and materials in the MARKETPLACE.
- Request WATER-TEST GIFT CARDS (incentives for customers who take a water test).
- Read reference material: PRODUCT LIBRARY, HD PROMOTIONS, HD CREDIT CARD info, and RESOURCES.
- Use the HD PAYOUT CALCULATOR to estimate their payout on a deal.
- View REPORTS: monthly performance and weekly store detail; office owners also see product pricing, sales reps, custom reports, a forecast, and accounting.
- MAIL / deal conversations: message the reviewer team about a specific deal.
- This CHAT is the general support line to the Georgian Water & Air team.

Navigation: the main actions are in the left sidebar (desktop) or the bottom bar / ☰ menu (mobile): Home, Applications/Deals, New, Leads, Mail, and Help (this chat).`;

function systemPrompt(locale: 'en' | 'fr', knowledge?: string | null): string {
  const lang = locale === 'fr' ? 'Canadian French (fr-CA)' : 'English';
  const teamKnowledge = knowledge?.trim()
    ? `\n\nTEAM KNOWLEDGE — written by the Georgian Water & Air team. Treat this as AUTHORITATIVE and prefer it over your general knowledge whenever relevant; answer in the team's voice using these facts, processes and policies:\n"""\n${knowledge.trim()}\n"""`
    : '';
  return `You are the support assistant inside the Georgian Water & Air Dealer Portal, helping dealers (Home Depot water-treatment sales reps) use the portal and answer product/process questions. Answer as a knowledgeable, friendly member of the Georgian Water & Air team would.

${PORTAL_FACTS}${teamKnowledge}

Rules:
- Reply in ${lang}. Be warm, direct and genuinely useful — give real steps and specifics, not vague pointers. Usually 1-5 sentences; use a short numbered list for a process.
- Always call the company "Georgian Water & Air" (never "GWA" alone or "Georgian Water").
- Ground answers in the portal facts and TEAM KNOWLEDGE above. The team knowledge wins over any general assumption.
- You do NOT have access to any specific customer, application, deal, dollar figure, credit decision, approval status, or timeline. Never invent or guess these.
- If you don't know the answer, it isn't covered above, or it needs a specific/binding answer you can't verify, do NOT guess. Say warmly that you're not certain and you'll find someone on the Georgian Water & Air team who can help — a real teammate can jump into this same chat anytime.
- Never promise approvals, pricing, payouts, or anything binding, and don't state policy that isn't in the team knowledge.
- Don't ask for or repeat full credit card numbers or SIN/SSN.`;
}

/**
 * Generate a support reply from recent conversation turns. `knowledge` is the
 * admin-written team knowledge (authoritative). Returns null on any failure
 * (missing key, API error, empty output) so the caller can fall back.
 */
export async function generateSupportReply(turns: AiTurn[], locale: 'en' | 'fr', knowledge?: string | null): Promise<string | null> {
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
        system: systemPrompt(locale, knowledge),
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
