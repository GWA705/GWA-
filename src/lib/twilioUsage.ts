import 'server-only';

// Read-only Twilio usage/billing lookups for the Admin "cost meter". Uses the
// same TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN already configured for sending;
// no new credentials. Everything is best-effort and returns nulls/zeros when
// texting isn't configured, so the UI degrades gracefully.

const BASE = 'https://api.twilio.com/2010-04-01';

function creds(): { sid: string; auth: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, auth: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` };
}

async function twilioGet(path: string): Promise<unknown> {
  const c = creds();
  if (!c) throw new Error('not-configured');
  const res = await fetch(`${BASE}/Accounts/${c.sid}${path}`, {
    headers: { Authorization: c.auth },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`twilio_http_${res.status}`);
  return res.json();
}

export interface UsageSlice {
  count: number; // messages
  price: number; // cost in the account currency
  currency: string; // ISO code, e.g. "USD" / "CAD"
}

export interface TwilioUsage {
  balance: { amount: number; currency: string } | null; // remaining funds (prepaid) / running balance
  thisMonth: UsageSlice;
  today: UsageSlice;
}

/**
 * Parse one Twilio "Usage/Records" response into a slice. Twilio returns the
 * aggregated record for the requested category + period as the first element.
 * Pure + exported so it's unit-testable without hitting the network.
 */
export function parseUsageRecord(json: unknown): UsageSlice {
  const rec = (json as { usage_records?: Array<Record<string, unknown>> } | null)?.usage_records?.[0];
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    count: rec ? num(rec.count) : 0,
    price: rec ? num(rec.price) : 0,
    currency: String((rec?.price_unit as string) || 'usd').toUpperCase(),
  };
}

function parseBalance(json: unknown): { amount: number; currency: string } | null {
  const b = json as { balance?: unknown; currency?: unknown } | null;
  if (!b || b.balance == null) return null;
  const amount = Number(b.balance);
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: String((b.currency as string) || 'USD').toUpperCase() };
}

/** Fetch balance + SMS spend for this month and today. Throws on auth errors. */
export async function getTwilioUsage(): Promise<TwilioUsage> {
  const [balJson, monthJson, todayJson] = await Promise.all([
    // Balance can be unavailable on some account types — don't fail the whole meter for it.
    twilioGet('/Balance.json').catch(() => null),
    twilioGet('/Usage/Records/ThisMonth.json?Category=sms'),
    twilioGet('/Usage/Records/Today.json?Category=sms'),
  ]);
  return {
    balance: parseBalance(balJson),
    thisMonth: parseUsageRecord(monthJson),
    today: parseUsageRecord(todayJson),
  };
}
