import 'server-only';
import { recordAiUsage, AI_SERVICES } from './aiUsage';

/**
 * Read the key fields off a finished Home Depot / Entuitive ID card (image or
 * PDF) with Claude vision, so the reviewer doesn't retype them. Best-effort:
 * returns null (and the reviewer types by hand) whenever the AI is off or the
 * read fails. Reuses the same Messages API + card-scan usage metering as the
 * lead-card reader.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export interface ParsedIdTagCard {
  validUntil: string | null; // YYYY-MM-DD
  badgeNumber: string | null; // digits only
  entuitiveStatus: string | null;
}

/** Whether we can hand this file to the vision model (image or PDF). */
export function cardIsReadable(mime: string): boolean {
  return mime === 'application/pdf' || IMAGE_MIME.has(mime);
}

export async function parseIdTagCard(bytes: Buffer, mime: string): Promise<ParsedIdTagCard | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !cardIsReadable(mime)) return null;

  const b64 = bytes.toString('base64');
  const media = IMAGE_MIME.has(mime)
    ? { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } };

  const instruction =
    'This image/PDF is a Home Depot "Authorized Installer" (Entuitive) ID badge card. ' +
    'Read the printed text and reply with ONLY a JSON object, no prose or code fences:\n' +
    '{"validUntil":"YYYY-MM-DD","badgeNumber":"digits","entuitiveStatus":"word"}\n' +
    '- validUntil = the "Valid until / Valide jusqu\'à" date, formatted YYYY-MM-DD.\n' +
    '- badgeNumber = the "Badge HD / De Badge" number (digits only).\n' +
    '- entuitiveStatus = the status word shown (e.g. "Approved").\n' +
    'Use null for any field you cannot read. Output the JSON object and nothing else.';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: [media, { type: 'text', text: instruction }] }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[idTagCard] Anthropic ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    if (data.usage) {
      void recordAiUsage({
        service: AI_SERVICES.cardScan,
        model: data.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        inputTokens: data.usage.input_tokens ?? 0,
        outputTokens: data.usage.output_tokens ?? 0,
      });
    }
    const text = (data.content ?? []).filter((b) => b.type === 'text' && b.text).map((b) => b.text!).join('').trim();
    return normalizeParsed(text);
  } catch (e) {
    console.error('[idTagCard] parse failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

function normalizeParsed(text: string): ParsedIdTagCard | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/); // first JSON object, even if wrapped in prose
  if (!m) return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(m[0]); } catch { return null; }
  return {
    validUntil: normalizeDate(obj.validUntil),
    badgeNumber: normalizeBadge(obj.badgeNumber),
    entuitiveStatus: normalizeStr(obj.entuitiveStatus),
  };
}

function normalizeStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || /^null$/i.test(s)) return null;
  return s.slice(0, 60);
}
function normalizeBadge(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  const digits = s.replace(/\D+/g, '');
  return digits || null;
}
function normalizeDate(v: unknown): string | null {
  const s = normalizeStr(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    if (y > 2000 && y < 2100) {
      return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  return null;
}
