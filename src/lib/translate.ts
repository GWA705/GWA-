import 'server-only';

/**
 * Machine translation for dynamic, user-typed content (customer notes, chat,
 * free-text fields) — separate from the interface dictionaries in `src/i18n`.
 *
 * Provider chain:
 *   1. DeepL (best quality) when `DEEPL_API_KEY` is set. Free "Developer" keys
 *      end in ":fx" and use the free host; everything else uses the pro host.
 *   2. MyMemory (free, no account) as an automatic fallback when DeepL is not
 *      configured, out of quota, or unreachable — so reviewers keep getting
 *      translations without a paid plan. Optionally set `MYMEMORY_EMAIL` to lift
 *      the free daily limit (anonymous ~5k words/day → ~50k with an email).
 *
 * When every provider fails, callers get a clear "unavailable" result rather
 * than an error, so the UI degrades gracefully (shows the original text).
 */

export type TranslateTarget = 'EN' | 'FR';
export type TranslateProvider = 'deepl' | 'mymemory' | 'none';

export interface TranslateResult {
  ok: boolean;
  text: string;
  detectedSource?: string;
  provider?: TranslateProvider;
  error?: string;
}

export interface DeeplUsage {
  configured: boolean;
  ok: boolean;
  count?: number;
  limit?: number;
  error?: string;
}

export function isTranslationConfigured(): boolean {
  return !!process.env.DEEPL_API_KEY;
}

/** Translation always works (DeepL or the free fallback), so this is always true. */
export function isTranslationAvailable(): boolean {
  return true;
}

function deeplHost(key: string): string {
  return key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

/**
 * Translate a single string. `target` is the language you want out; `source`
 * is optional (auto-detected when omitted). Tries DeepL first, then the free
 * MyMemory fallback.
 */
export async function translateText(
  text: string,
  target: TranslateTarget,
  source?: TranslateTarget,
): Promise<TranslateResult> {
  if (!text.trim()) return { ok: true, text, provider: 'none' };

  const key = process.env.DEEPL_API_KEY;
  if (key) {
    const d = await translateViaDeepl(text, target, key, source);
    if (d.ok) return d;
    // DeepL failed (out of quota, network, bad key…) — fall through to the free
    // provider so translation keeps working.
  }

  const m = await translateViaMyMemory(text, target, source);
  if (m.ok) return m;

  return { ok: false, text, provider: 'none', error: key ? 'all_providers_failed' : 'not_configured' };
}

async function translateViaDeepl(
  text: string,
  target: TranslateTarget,
  key: string,
  source?: TranslateTarget,
): Promise<TranslateResult> {
  try {
    const body = new URLSearchParams();
    body.append('text', text);
    body.append('target_lang', target);
    if (source) body.append('source_lang', source);

    const res = await fetch(`${deeplHost(key)}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    });

    if (!res.ok) return { ok: false, text, provider: 'deepl', error: `deepl_${res.status}` };
    const data = (await res.json()) as {
      translations?: { detected_source_language?: string; text?: string }[];
    };
    const first = data.translations?.[0];
    if (!first?.text) return { ok: false, text, provider: 'deepl', error: 'empty' };
    return { ok: true, text: first.text, detectedSource: first.detected_source_language, provider: 'deepl' };
  } catch {
    return { ok: false, text, provider: 'deepl', error: 'network' };
  }
}

/**
 * Free fallback via MyMemory. Its GET endpoint caps each query near 500 bytes,
 * so long text is split into word-boundary chunks and rejoined. MyMemory needs
 * both sides of the language pair; when the source isn't given we assume the
 * other portal language (this app only ever moves EN↔FR).
 */
async function translateViaMyMemory(
  text: string,
  target: TranslateTarget,
  source?: TranslateTarget,
): Promise<TranslateResult> {
  const src = (source ?? (target === 'EN' ? 'FR' : 'EN')).toLowerCase();
  const tgt = target.toLowerCase();
  const email = process.env.MYMEMORY_EMAIL;

  const chunks = chunkForMyMemory(text, 480);
  const out: string[] = [];
  try {
    for (const chunk of chunks) {
      const params = new URLSearchParams({ q: chunk, langpair: `${src}|${tgt}` });
      if (email) params.append('de', email);
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { cache: 'no-store' });
      if (!res.ok) return { ok: false, text, provider: 'mymemory', error: `mymemory_${res.status}` };
      const data = (await res.json()) as {
        responseStatus?: number | string;
        responseData?: { translatedText?: string };
      };
      const status = Number(data.responseStatus);
      const translated = data.responseData?.translatedText ?? '';
      // MyMemory signals the daily cap with a 4xx status and/or an ALL-CAPS
      // "WARNING" string in place of a translation — treat both as a failure.
      if (status !== 200 || !translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) {
        return { ok: false, text, provider: 'mymemory', error: `mymemory_${status || 'warn'}` };
      }
      out.push(translated);
    }
    return { ok: true, text: out.join(''), detectedSource: src.toUpperCase(), provider: 'mymemory' };
  } catch {
    return { ok: false, text, provider: 'mymemory', error: 'network' };
  }
}

/** Split on whitespace so each piece stays under MyMemory's per-query limit. */
function chunkForMyMemory(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let cur = '';
  for (const token of text.split(/(\s+)/)) {
    if (cur.length + token.length > max && cur) {
      parts.push(cur);
      cur = token;
    } else {
      cur += token;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * DeepL usage (characters used vs. plan limit) for the admin usage panel.
 * Returns `configured: false` when no key is set (the app is on the free
 * fallback), so the UI can say so plainly.
 */
export async function deeplUsage(): Promise<DeeplUsage> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return { configured: false, ok: false };
  try {
    const res = await fetch(`${deeplHost(key)}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return { configured: true, ok: false, error: `deepl_${res.status}` };
    const d = (await res.json()) as { character_count?: number; character_limit?: number };
    return { configured: true, ok: true, count: d.character_count, limit: d.character_limit };
  } catch {
    return { configured: true, ok: false, error: 'network' };
  }
}
