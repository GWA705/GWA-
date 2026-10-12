import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '@/i18n/dictionaries/en';
import { fr } from '@/i18n/dictionaries/fr';

/**
 * Guard against silent English fallback: every literal translation key used in
 * the app — t('group.key') / t("group.key") — must exist in BOTH the English and
 * French dictionaries. A missing French key would quietly show English; a missing
 * English key would show the raw key. This catches both before they ship.
 *
 * Only statically-literal keys are checked. Dynamic keys built by concatenation
 * (e.g. t('progress.stage.' + k)) can't be resolved here, so their families are
 * asserted explicitly below.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

function lookup(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

// Match t('a.b.c') and t("a.b.c") — a single string-literal argument, no
// concatenation or interpolation. Keys are dotted identifiers.
const CALL_RE = /\bt\(\s*(['"])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)\1\s*[),]/g;

function collectKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(text))) {
      const key = m[2];
      const arr = keys.get(key) ?? [];
      arr.push(file.replace(process.cwd() + '/', ''));
      keys.set(key, arr);
    }
  }
  return keys;
}

describe('i18n key coverage', () => {
  const keys = collectKeys();

  it('finds a meaningful number of literal keys', () => {
    expect(keys.size).toBeGreaterThan(100);
  });

  it('every literal t() key exists in English', () => {
    const missing: string[] = [];
    for (const [key, files] of keys) {
      if (lookup(en, key) === undefined) missing.push(`${key}  (${files[0]})`);
    }
    expect(missing, `Missing in en.ts:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every literal t() key exists in French', () => {
    const missing: string[] = [];
    for (const [key, files] of keys) {
      if (lookup(fr, key) === undefined) missing.push(`${key}  (${files[0]})`);
    }
    expect(missing, `Missing in fr.ts:\n${missing.join('\n')}`).toEqual([]);
  });
});
