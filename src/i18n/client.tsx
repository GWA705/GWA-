'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from './config';
import { makeT, type TFunction } from './translator';

interface I18nValue {
  locale: Locale;
  t: TFunction;
}

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, t: makeT(DEFAULT_LOCALE) });

/**
 * Provides the active locale to client components. The dictionaries are plain
 * static objects imported by `makeT`, so only the locale needs to cross the
 * server→client boundary. Wrap the tree in the root layout.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, t: makeT(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Client hook: `const { t, locale } = useI18n()`. */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Convenience: just the translate function. */
export function useT(): TFunction {
  return useContext(I18nContext).t;
}
