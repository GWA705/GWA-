'use client';

import { useTransition } from 'react';
import { Globe } from 'lucide-react';
import { setLocale } from '@/i18n/actions';
import { useI18n } from '@/i18n/client';
import { LOCALE_SHORT, type Locale } from '@/i18n/config';

/**
 * Compact EN / FR language switcher for the top bar. Writes the locale cookie
 * (server action) and refreshes so both server- and client-rendered copy swap.
 * Hidden in production until the whole site is translated — see I18N_UI_ENABLED.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === 'en' ? 'fr' : 'en';

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setLocale(next))}
      className={`topbar-btn inline-flex items-center gap-1.5 text-sm font-semibold disabled:opacity-60 ${className}`}
      title={next === 'fr' ? 'Passer en français' : 'Switch to English'}
      aria-label={next === 'fr' ? 'Passer en français' : 'Switch to English'}
    >
      <Globe size={16} />
      <span>{LOCALE_SHORT[next]}</span>
    </button>
  );
}
