import 'server-only';

/**
 * Minimal Guusto API client. Sends rewards (gift cards) programmatically via
 * POST /api/v1/orders using a workspace API token (Bearer). Reason, merchant,
 * message and claim period are per-order fields, so a portal gift-card approval
 * can fire a $25 Home Depot card with the right office's reason + 1-month claim.
 *
 * Config (env, set in Render):
 *   GUUSTO_API_TOKEN  — the workspace API token (required)
 *   GUUSTO_API_BASE   — API base URL (optional; defaults below)
 *
 * The exact request-body field names are being confirmed against the live
 * account via the Super-Admin test harness (/admin/guusto-test), so this stays
 * a thin pass-through for now — nothing fires automatically.
 */

export function guustoConfigured(): boolean {
  return !!process.env.GUUSTO_API_TOKEN;
}

export function guustoBaseUrl(): string {
  return (process.env.GUUSTO_API_BASE || 'https://api.guusto.com').replace(/\/$/, '');
}

export interface GuustoResult {
  ok: boolean;
  status: number;
  body: unknown; // parsed JSON when possible, else raw text
  error?: string;
}

/** Low-level authenticated call to the Guusto API. Never returns the token. */
export async function guustoRequest(
  path: string,
  method: string,
  body?: unknown,
  baseOverride?: string,
): Promise<GuustoResult> {
  const token = process.env.GUUSTO_API_TOKEN;
  if (!token) return { ok: false, status: 0, body: null, error: 'GUUSTO_API_TOKEN is not set.' };
  const base = (baseOverride?.trim() || guustoBaseUrl()).replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body != null && method.toUpperCase() !== 'GET' ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* leave as raw text */
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: (e as Error).message };
  }
}
