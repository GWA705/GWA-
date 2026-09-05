import 'server-only';

/**
 * DeepL machine translation for dynamic, user-typed content (customer notes,
 * free-text fields) — separate from the interface dictionaries in `src/i18n`.
 *
 * Configure with `DEEPL_API_KEY` in Render. Free keys end in ":fx" and use the
 * free host; everything else uses the pro host. When no key is set, callers get
 * a clear "unavailable" result rather than an error, so the UI can degrade
 * gracefully (show the original text with a disabled button).
 */

export type TranslateTarget = 'EN' | 'FR';

export interface TranslateResult {
  ok: boolean;
  text: string;
  detectedSource?: string;
  error?: string;
}

export function isTranslationConfigured(): boolean {
  return !!process.env.DEEPL_API_KEY;
}

function deeplHost(key: string): string {
  return key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

/**
 * Translate a single string. `target` is the language you want out; `source`
 * is optional (DeepL auto-detects when omitted). DeepL wants target "EN-CA"/
 * "EN-GB"/"EN-US" for English variants; we use plain "EN" (any English) and
 * "FR" for French, which is what this portal needs.
 */
export async function translateText(
  text: string,
  target: TranslateTarget,
  source?: TranslateTarget,
): Promise<TranslateResult> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return { ok: false, text, error: 'not_configured' };
  if (!text.trim()) return { ok: true, text };

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
      // Never cache credentials'd calls.
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, text, error: `deepl_${res.status}` };
    }
    const data = (await res.json()) as {
      translations?: { detected_source_language?: string; text?: string }[];
    };
    const first = data.translations?.[0];
    if (!first?.text) return { ok: false, text, error: 'empty' };
    return { ok: true, text: first.text, detectedSource: first.detected_source_language };
  } catch {
    return { ok: false, text, error: 'network' };
  }
}
