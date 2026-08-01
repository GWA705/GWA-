import crypto from 'crypto';

/**
 * FinanceIt API integration helpers — webhook signature/replay verification and
 * a hardened outbound client. Everything here is DORMANT until the env vars are
 * set, so it ships safely and is switched on when FinanceIt provides the real
 * secret, endpoints, and payload/signature contract.
 *
 * Env:
 *   FINANCEIT_WEBHOOK_SECRET  HMAC secret FinanceIt signs inbound webhooks with
 *   FINANCEIT_API_KEY         bearer/API key for outbound calls
 *   FINANCEIT_API_BASE        outbound API base URL (confirm with FinanceIt)
 *   FINANCEIT_WEBHOOK_SKEW_SECONDS  optional replay window (default 300)
 *
 * NOTE: the exact signature scheme and header names below are sensible defaults
 * (HMAC-SHA256 over "<timestamp>.<rawBody>", signature in `x-financeit-signature`,
 * timestamp in `x-financeit-timestamp`). Confirm and adjust to FinanceIt's real
 * contract before going live — this is called out in docs/FINANCEIT-API.md.
 */

export function webhookSecret(): string | null {
  return process.env.FINANCEIT_WEBHOOK_SECRET || null;
}
export function financeitConfigured(): boolean {
  return !!process.env.FINANCEIT_API_KEY;
}

const SKEW_SECONDS = Number(process.env.FINANCEIT_WEBHOOK_SKEW_SECONDS || 300);

/** Timing-safe compare of two hex signatures of equal logical length. */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // Hash both to a fixed length so timingSafeEqual never throws on length diff
  // and length isn't leaked.
  const ha = crypto.createHash('sha256').update(ba).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export interface WebhookVerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verify an inbound webhook: the HMAC signature must match, and the signed
 * timestamp must be recent (replay protection). Pass the RAW request body
 * (never the re-serialized JSON) and the relevant headers.
 */
export function verifyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): WebhookVerifyResult {
  const secret = webhookSecret();
  if (!secret) return { ok: false, reason: 'not_configured' };
  if (!signatureHeader) return { ok: false, reason: 'missing_signature' };

  // Replay window: require a recent signed timestamp when one is provided.
  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts)) return { ok: false, reason: 'bad_timestamp' };
    const nowSec = Math.floor(Date.now() / 1000);
    // Accept seconds or milliseconds epoch.
    const tsSec = ts > 1e12 ? Math.floor(ts / 1000) : ts;
    if (Math.abs(nowSec - tsSec) > SKEW_SECONDS) return { ok: false, reason: 'timestamp_skew' };
  }

  const signedPayload = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // Tolerate a "sha256=" prefix or a comma-separated list of candidate sigs.
  const candidates = signatureHeader
    .split(',')
    .map((s) => s.trim().replace(/^sha256=/i, ''))
    .filter(Boolean);
  const match = candidates.some((c) => safeEqualHex(c, expected));
  return match ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

// --- Outbound client -------------------------------------------------------

export interface FinanceitCallResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Call the FinanceIt API with TLS verification on, a hard timeout, and bounded
 * exponential backoff on 5xx/network errors. Credentials come from env only and
 * are never logged. Do NOT retry non-idempotent POSTs without an idempotency
 * key (pass one via headers when FinanceIt supports it).
 */
export async function financeitFetch<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<FinanceitCallResult<T>> {
  const apiKey = process.env.FINANCEIT_API_KEY;
  const base = (process.env.FINANCEIT_API_BASE || '').replace(/\/$/, '');
  if (!apiKey || !base) return { ok: false, status: 0, error: 'FinanceIt API is not configured.' };

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const { timeoutMs = 10_000, retries = 2, headers, ...rest } = init;
  const method = (rest.method || 'GET').toUpperCase();

  let lastErr = 'unknown error';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: T | undefined;
      try {
        data = text ? (JSON.parse(text) as T) : undefined;
      } catch {
        /* non-JSON response */
      }
      // Retry idempotent methods on 5xx.
      if (res.status >= 500 && method === 'GET' && attempt < retries) {
        lastErr = `HTTP ${res.status}`;
      } else {
        return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : `HTTP ${res.status}` };
      }
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err.message : 'network error';
      // Only retry safe (GET) requests on network/timeout failures.
      if (method !== 'GET' || attempt >= retries) {
        return { ok: false, status: 0, error: lastErr };
      }
    }
    // Exponential backoff with jitter: 200ms, 400ms, ...
    const delay = 200 * 2 ** attempt + Math.floor(Math.random() * 100);
    await new Promise((r) => setTimeout(r, delay));
  }
  return { ok: false, status: 0, error: lastErr };
}
