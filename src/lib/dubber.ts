import 'server-only';

/**
 * Bell Total Connect call-recording client.
 *
 * Bell Total Connect's call recording is powered by Dubber, which exposes a REST
 * API. This module wraps the two calls we need — list recent recordings, and
 * download a recording's audio — behind a small, normalized interface so the
 * ingest job (callRecordings.ts) doesn't care about Dubber's wire format.
 *
 * It is INERT until credentials are configured:
 *   DUBBER_API_KEY / DUBBER_API_SECRET   — Mashery key + secret from the Dubber
 *                                          developer platform (via your Bell acct)
 *   DUBBER_API_BASE   (optional)         — API base, defaults below
 *   DUBBER_ACCOUNT_ID (optional)         — scope the pull to one Dubber account
 *
 * NOTE: the exact endpoint shapes below follow Dubber's documented API but must
 * be verified against the live account once the key is issued — response field
 * names are normalized defensively so small differences don't break ingest.
 */

const DEFAULT_BASE = 'https://api.dubber.net';

export function dubberEnabled(): boolean {
  return Boolean(process.env.DUBBER_API_KEY && process.env.DUBBER_API_SECRET);
}

function base(): string {
  return (process.env.DUBBER_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

// A recording, normalized to what we store.
export interface DubberRecording {
  externalId: string;
  direction: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  startedAt: Date | null;
  durationSec: number | null;
  mediaUrl: string | null; // where the audio can be downloaded, if given inline
}

// --- auth ------------------------------------------------------------------

let _token: { value: string; exp: number } | null = null;

/** OAuth2 client-credentials token (Mashery key + secret), cached until expiry. */
async function token(): Promise<string> {
  const now = Date.now();
  if (_token && _token.exp > now + 30_000) return _token.value;
  const res = await fetch(`${base()}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.DUBBER_API_KEY as string,
      client_secret: process.env.DUBBER_API_SECRET as string,
    }),
  });
  if (!res.ok) throw new Error(`Dubber auth failed (${res.status})`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('Dubber auth returned no token');
  _token = { value: j.access_token, exp: now + (j.expires_in ?? 3600) * 1000 };
  return _token.value;
}

function s(v: unknown): string | null {
  const t = String(v ?? '').trim();
  return t || null;
}

function normalize(raw: Record<string, unknown>): DubberRecording | null {
  const externalId = s(raw.id ?? raw.recordingId ?? raw.dubGuid);
  if (!externalId) return null;
  const startedRaw = s(raw.startTime ?? raw.started ?? raw.date ?? raw.createdAt);
  const started = startedRaw ? new Date(startedRaw) : null;
  const durRaw = raw.duration ?? raw.durationSeconds ?? raw.length;
  const dur = durRaw == null ? null : Math.round(Number(durRaw)) || null;
  return {
    externalId,
    direction: s(raw.direction ?? raw.callDirection),
    fromNumber: s(raw.from ?? raw.fromNumber ?? raw.ani),
    toNumber: s(raw.to ?? raw.toNumber ?? raw.dnis),
    startedAt: started && !isNaN(started.getTime()) ? started : null,
    durationSec: dur,
    mediaUrl: s(raw.mediaUrl ?? raw.downloadUrl ?? raw.contentUrl),
  };
}

/** List recordings created since `since`. Returns [] when not configured. */
export async function dubberListRecordings(since: Date): Promise<DubberRecording[]> {
  if (!dubberEnabled()) return [];
  const t = await token();
  const acct = process.env.DUBBER_ACCOUNT_ID;
  const params = new URLSearchParams({ startTime: since.toISOString(), pageSize: '200' });
  if (acct) params.set('accountId', acct);
  const res = await fetch(`${base()}/v3/recordings?${params}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Dubber list failed (${res.status})`);
  const j = (await res.json()) as { data?: unknown[]; recordings?: unknown[] };
  const list = (j.data ?? j.recordings ?? []) as Record<string, unknown>[];
  return list.map(normalize).filter((r): r is DubberRecording => r !== null);
}

/** Download a recording's audio bytes + mime. */
export async function dubberDownloadRecording(rec: DubberRecording): Promise<{ buffer: Buffer; mime: string }> {
  if (!dubberEnabled()) throw new Error('Dubber is not configured.');
  const t = await token();
  const url = rec.mediaUrl || `${base()}/v3/recordings/${encodeURIComponent(rec.externalId)}/media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error(`Dubber download failed (${res.status})`);
  const mime = res.headers.get('content-type') || 'audio/mpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mime };
}
