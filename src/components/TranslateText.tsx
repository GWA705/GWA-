'use client';

import { useState, useTransition } from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { translateContent } from '@/i18n/contentActions';

/**
 * Shows a block of user-typed content with an on-demand "Translate" toggle.
 * Translates to the viewer's current interface language (FR viewers get French,
 * EN reviewers get English), powered by DeepL. Degrades gracefully when the
 * DeepL key isn't configured — the button just reports it's unavailable.
 */
export function TranslateText({ text, className = '' }: { text: string; className?: string }) {
  const { locale, t } = useI18n();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState<'original' | 'translated'>('original');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const target = locale === 'fr' ? 'FR' : 'EN';

  function onToggle() {
    setError(null);
    if (showing === 'translated') {
      setShowing('original');
      return;
    }
    if (translated !== null) {
      setShowing('translated');
      return;
    }
    startTransition(async () => {
      const res = await translateContent(text, target);
      if (res.ok) {
        setTranslated(res.text);
        setShowing('translated');
      } else {
        setError(t('translate.unavailable'));
      }
    });
  }

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap">{showing === 'translated' && translated !== null ? translated : text}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline disabled:opacity-60"
        >
          <Languages size={13} />
          {pending
            ? t('translate.translating')
            : showing === 'translated'
              ? t('translate.showOriginal')
              : t('translate.translate')}
        </button>
        {error && <span className="text-xs text-gray-400">{error}</span>}
      </div>
    </div>
  );
}
