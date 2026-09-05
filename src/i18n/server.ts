import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { makeT, dictionaryFor, type TFunction } from './translator';

/** The viewer's locale, read from the language cookie (defaults to English). */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Server-side translate function for the current request's locale. */
export function getT(): TFunction {
  return makeT(getLocale());
}

/** The full dictionary for the current locale (for passing to a client tree). */
export function getDictionary() {
  return dictionaryFor(getLocale());
}
