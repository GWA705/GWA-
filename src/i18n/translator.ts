import { en, type Dictionary } from './dictionaries/en';
import { fr } from './dictionaries/fr';
import type { Locale } from './config';

const DICTS: Record<Locale, Dictionary> = { en, fr };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTS[locale] ?? en;
}

/** Resolve a dot-path (e.g. "shell.signOut") in a nested object. */
function lookup(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Build a translate function for a locale. Falls back to English, then to the
 * key itself, so a missing French string shows the English copy (never a blank
 * or a raw key) while the site is being translated.
 */
export function makeT(locale: Locale): TFunction {
  const dict = dictionaryFor(locale);
  return (key, vars) => {
    let value = lookup(dict, key) ?? lookup(en, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  };
}
