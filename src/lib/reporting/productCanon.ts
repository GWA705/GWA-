import { getSetting, setSetting } from '@/lib/settings';

/**
 * Product-code canonicalisation for the sales-journal reports. The journal's
 * product column is free text (e.g. "CITY,WS,WHCCF"), so case/spacing/typo/
 * variant differences make the same product count as several — which is why the
 * product-mix report shows ~72 distinct codes. An admin-managed alias map folds
 * the look-alikes into one canonical code; the dedupe tool suggests the merges
 * with fuzzy matching. (Same idea as the store-number canonicaliser.)
 */

export const PRODUCT_ALIAS_KEY = 'reporting.productAliases';

/** Key form of a raw code: uppercase, trim, collapse internal whitespace.
 *  Conservative — keeps punctuation/suffixes (PH600+ stays distinct from PH600
 *  until an admin maps it). */
export function normProductCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** A looser key (letters+digits only) used only for fuzzy grouping. */
export function looseKey(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

export type ProductAliasMap = Record<string, string>; // normCode -> canonical

export async function getProductAliases(): Promise<ProductAliasMap> {
  const raw = await getSetting(PRODUCT_ALIAS_KEY);
  if (!raw) return {};
  try {
    const m = JSON.parse(raw);
    return m && typeof m === 'object' && !Array.isArray(m) ? (m as ProductAliasMap) : {};
  } catch {
    return {};
  }
}

/** Save the alias map. Self-maps and empties are dropped; {} clears it. */
export async function setProductAliases(map: ProductAliasMap): Promise<void> {
  const clean: ProductAliasMap = {};
  for (const [k, v] of Object.entries(map || {})) {
    const kk = normProductCode(k);
    const vv = normProductCode(v);
    if (kk && vv && kk !== vv) clean[kk] = vv;
  }
  await setSetting(PRODUCT_ALIAS_KEY, Object.keys(clean).length ? JSON.stringify(clean) : '');
}

/** canon(rawCode): normalise, then follow the alias map (resolves a few hops). */
export function makeProductCanon(aliases: ProductAliasMap): (raw: string) => string {
  return (raw: string) => {
    let c = normProductCode(raw);
    for (let i = 0; i < 5 && aliases[c] && aliases[c] !== c; i++) c = aliases[c];
    return c;
  };
}

/** Levenshtein edit distance (small strings). */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

/** Do two codes look like the same product? (suggestions only — admin confirms) */
export function looksSimilar(a: string, b: string): boolean {
  if (a === b) return false;
  const la = looseKey(a), lb = looseKey(b);
  if (!la || !lb) return false;
  if (la === lb) return true; // same ignoring case / spaces / punctuation
  // one contained in the other (e.g. PH600 ⊂ ELEVATE PH600), shorter ≥ 3
  if ((la.includes(lb) || lb.includes(la)) && Math.min(la.length, lb.length) >= 3) return true;
  // small typo distance relative to length
  const d = levenshtein(la, lb);
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen >= 4 && d <= (maxLen <= 6 ? 1 : 2)) return true;
  return false;
}

/** Group codes into clusters of look-alikes (clusters of ≥ 2). */
export function suggestClusters(codes: string[]): string[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  for (const c of codes) if (!parent.has(c)) parent.set(c, c);
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      if (looksSimilar(codes[i], codes[j])) union(codes[i], codes[j]);
    }
  }
  const groups = new Map<string, string[]>();
  for (const c of codes) {
    const r = find(c);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(c);
  }
  return Array.from(groups.values()).filter((g) => g.length > 1);
}
