import 'server-only';
import {
  gmailReadClient,
  gmailReadConfigured,
  gmailHeader,
  gmailParseDate,
  gmailBodyText,
} from './gmailClient';
import {
  FINANCEIT_FROM,
  parseFinanceitEmail,
  fieldScore,
  digitsOnly,
  last10,
  type FinanceitEmailData,
} from './financeitEmailParse';

/**
 * Read FinanceIt's deal-notification emails (from partners@financeit.io) and find
 * the one(s) for a given deal, so a reviewer can pull the real financing details
 * onto a deal on demand — filling the confirmer's terms (amount, term, monthly
 * payment, phone) and confirming the FinanceIt loan number straight from the
 * lender, within seconds of approval.
 *
 * READ-ONLY. Pure parsing lives in financeitEmailParse.ts; this adds the Gmail
 * fetch + deal-matching. Inert until the shared Gmail read client is configured.
 */

export { gmailReadConfigured as financeitEmailConfigured };
export type { FinanceitEmailData, FinanceitLifecycle } from './financeitEmailParse';

async function fetchParsed(id: string): Promise<FinanceitEmailData | null> {
  const res = await gmailReadClient().users.messages.get({ userId: 'me', id, format: 'full' });
  const subject = gmailHeader(res.data.payload, 'Subject');
  const sentAt = gmailParseDate(gmailHeader(res.data.payload, 'Date'));
  const body = gmailBodyText(res.data.payload) || res.data.snippet || '';
  return parseFinanceitEmail(id, subject, sentAt, body);
}

/** Quote-strip a term so it's a safe literal inside a Gmail search query. */
function q(term: string): string {
  return term.replace(/["\n\r]/g, ' ').trim();
}

export interface FinanceitMatchInput {
  loanNumber?: string | null; // the deal's financeItNumber, if known
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface FinanceitMatchResult {
  best: FinanceitEmailData | null; // richest matching email (fills the fields)
  finalized: FinanceitEmailData | null; // a "funded & finalized" email, if any
  candidates: number; // how many FinanceIt emails were examined
  matchedBy: 'loan-number' | 'phone' | 'name' | null;
}

/**
 * Find the FinanceIt email(s) for one deal. Matches by loan number first (the
 * strongest signal — it equals the deal's financeItNumber), then by phone, then
 * by name. Returns the richest matching email to fill fields from, plus any
 * "finalized" email so the caller can see whether FinanceIt has funded it.
 * Best-effort: returns empties (not an error) when unconfigured or nothing matches.
 */
export async function findFinanceitEmailForDeal(input: FinanceitMatchInput): Promise<FinanceitMatchResult> {
  const empty: FinanceitMatchResult = { best: null, finalized: null, candidates: 0, matchedBy: null };
  if (!gmailReadConfigured()) return empty;

  const loan = digitsOnly(input.loanNumber);
  const phone10 = last10(input.phone);
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();

  // Query in priority order; stop at the first that finds a genuine match. Each
  // query is scoped to FinanceIt's sender so it can only ever match their mail.
  const queries: { q: string; by: NonNullable<FinanceitMatchResult['matchedBy']> }[] = [];
  if (loan) queries.push({ q: `from:${FINANCEIT_FROM} "${loan}"`, by: 'loan-number' });
  if (phone10) queries.push({ q: `from:${FINANCEIT_FROM} "${phone10}"`, by: 'phone' });
  if (name) queries.push({ q: `from:${FINANCEIT_FROM} "${q(name)}"`, by: 'name' });
  if (queries.length === 0) return empty;

  const gmail = gmailReadClient();
  for (const { q: query, by } of queries) {
    let ids: string[] = [];
    try {
      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 10 });
      ids = (res.data.messages || []).map((m) => m.id).filter((x): x is string => !!x);
    } catch (e) {
      console.error('[financeitEmail] search failed', e);
      continue;
    }
    if (ids.length === 0) continue;

    const parsed: FinanceitEmailData[] = [];
    for (const id of ids) {
      const p = await fetchParsed(id);
      if (p) parsed.push(p);
    }
    // Keep only emails that genuinely belong to this deal for the match type used.
    const matches = parsed.filter((d) => {
      if (by === 'loan-number') return d.loanNumber === loan;
      if (by === 'phone') return last10(d.phone) === phone10;
      return !!name && (d.customerName || '').trim().toLowerCase() === name.toLowerCase();
    });
    if (matches.length === 0) continue;

    // Richest email fills the fields; a dedicated finalized email reports funding.
    const best = [...matches].sort((a, b) => fieldScore(b) - fieldScore(a))[0];
    const finalized = matches
      .filter((d) => d.lifecycle === 'FINALIZED')
      .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))[0] ?? null;
    return { best, finalized, candidates: parsed.length, matchedBy: by };
  }
  return empty;
}
