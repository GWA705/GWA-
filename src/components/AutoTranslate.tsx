'use client';

import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { translateContent } from '@/i18n/contentActions';

/**
 * Auto-translating block of user-typed content (chat messages, notes, free
 * text). Unlike <TranslateText> (a manual toggle), this converts to the
 * viewer's interface language automatically on load — so an English reviewer
 * reads a French dealer's message in English right away, and a French dealer
 * reads an English reply in French — with a subtle "show original" toggle.
 *
 * Cost- and latency-aware:
 *  - A cheap client-side heuristic skips text that already looks like the
 *    viewer's language, so no DeepL call is made for same-language content.
 *  - Results are cached per (target, text) for the session, so re-renders and
 *    repeated messages don't re-translate.
 *  - Degrades silently: if DeepL isn't configured or a call fails, the original
 *    text just stays on screen with no note or error.
 *
 * DeepL's detected source language is checked too: if it turns out the text was
 * already in the viewer's language, the original is shown with no "translated"
 * note (the heuristic can be wrong; this is the authoritative correction).
 */

type Target = 'EN' | 'FR';

// Session cache: `${target}:${text}` -> { text, detectedSource } (or null when
// the text is already in the target language / translation was a no-op).
const CACHE = new Map<string, { text: string; detectedSource?: string } | null>();

const FRENCH_SIGNAL = /[àâçéèêëîïôûùüœ]|\b(le|la|les|un|une|des|du|est|vous|nous|avec|pour|bonjour|merci|oui|non|je|ne|pas|s['’]il|d['’]|l['’])\b/i;

/** Guess whether `text` is worth translating for a viewer wanting `target`. */
function worthTranslating(text: string, target: Target): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (!/[a-zA-Zàâçéèêëîïôûùüœ]{3,}/.test(t)) return false; // no real words (numbers/symbols)
  const french = FRENCH_SIGNAL.test(t);
  return target === 'EN' ? french : !french;
}

function langName(t: (k: string, v?: Record<string, string | number>) => string, code?: string): string {
  if (code === 'FR') return t('translate.langFR');
  if (code === 'EN') return t('translate.langEN');
  return t('translate.langOther');
}

export function AutoTranslate({
  text,
  className = '',
  tone = 'light',
}: {
  text: string;
  className?: string;
  // 'dark' styles the footnote for a dark/coloured chat bubble.
  tone?: 'light' | 'dark';
}) {
  const { locale, t } = useI18n();
  const target: Target = locale === 'fr' ? 'FR' : 'EN';
  const cacheKey = `${target}:${text}`;

  const seeded = CACHE.get(cacheKey);
  const [result, setResult] = useState<{ text: string; detectedSource?: string } | null | undefined>(
    seeded !== undefined ? seeded : undefined,
  );
  // What the viewer is currently looking at. Defaults to the translation once
  // it's available; they can flip to the original and back.
  const [showing, setShowing] = useState<'auto' | 'original' | 'translated'>('auto');

  useEffect(() => {
    if (result !== undefined) return; // already cached / resolved
    if (!worthTranslating(text, target)) {
      CACHE.set(cacheKey, null);
      setResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await translateContent(text, target);
      // A successful translation that actually changed the text and came from a
      // different language is a real translation; otherwise treat as no-op.
      const usable =
        res.ok && res.text && res.detectedSource !== target && res.text.trim() !== text.trim()
          ? { text: res.text, detectedSource: res.detectedSource }
          : null;
      if (!cancelled) {
        CACHE.set(cacheKey, usable);
        setResult(usable);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const hasTranslation = !!result;
  // Resolve what to render: 'auto' shows the translation when we have one.
  const showTranslated = hasTranslation && showing !== 'original';
  const body = showTranslated ? result!.text : text;
  const footCls = tone === 'dark' ? 'text-white/70' : 'text-gray-400';
  const linkCls = tone === 'dark' ? 'font-semibold text-white underline hover:opacity-80' : 'font-semibold text-blue-600 hover:underline';

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap break-words">{body}</p>
      {hasTranslation && (
        <div className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] ${footCls}`}>
          <Languages size={11} aria-hidden />
          {showTranslated ? (
            <>
              <span>{t('translate.autoTranslated', { lang: langName(t, result!.detectedSource) })}</span>
              <span aria-hidden>·</span>
              <button type="button" onClick={() => setShowing('original')} className={linkCls}>
                {t('translate.showOriginal')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setShowing('translated')} className={linkCls}>
              {t('translate.showTranslation')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
