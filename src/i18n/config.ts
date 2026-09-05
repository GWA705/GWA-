/**
 * Site-wide internationalisation (i18n) config.
 *
 * The portal launches in English and adds Québec French (fr-CA). We keep the
 * locale in a cookie rather than in the URL, so none of the existing route
 * groups — (dealer)/(staff)/(admin)/(auth) — have to be restructured. Server
 * components read the cookie via `getLocale()`; client components read it from
 * the <LocaleProvider>. A single set of dictionaries powers both.
 */

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie that stores the viewer's chosen language. */
export const LOCALE_COOKIE = 'gwa-locale';

/** Human label for each locale, shown on the language toggle. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
};

/** Short code shown on the compact toggle button. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: 'EN',
  fr: 'FR',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/**
 * The language toggle is hidden in production until the whole site is
 * translated (the team chose an all-at-once launch — no half-French pages for
 * real users). Set NEXT_PUBLIC_I18N_ENABLED=1 in Render to reveal it.
 * The plumbing below is always active so we can build and test behind the flag.
 */
export const I18N_UI_ENABLED = process.env.NEXT_PUBLIC_I18N_ENABLED === '1';
