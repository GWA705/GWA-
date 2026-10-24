import 'server-only';
import { readJournal, EARLIEST_JOURNAL_YEAR } from './journalRead';
import { listReportOffices } from './monthly';

/**
 * Store-number canonicalisation — "auto-roll a mistyped store number into the
 * real store it belongs to".
 *
 * The journals carry the Home Depot store as free text in the "HD Store" cell,
 * e.g. "ORILLIA - 7137". The reporting reader pulls the first 4-digit number out
 * of that cell as the store number, so a single mis-typed digit ("ORILLIA -
 * 7124") invents a brand-new "store" that fragments one real store across the
 * reports. (Seen in the real data: Orillia 7137 also appears typed 7124, 7127,
 * 7138; Barrie 7024 appears typed as the name "BARRE" but with the right
 * number.)
 *
 * The fix, decided with the owner: fold a stray number into the real store by
 * matching the store NAME, and keep a record of what got merged so it stays
 * auditable. The rules are deliberately conservative so a typo can never BRIDGE
 * two real stores:
 *
 *   • A store number configured in Admin → Dealers is authoritative: it is never
 *     folded away, and it anchors its name.
 *   • Otherwise, for each store NAME, the canonical number is the configured one
 *     (if any) else the number that carries the most deals.
 *   • A non-configured number is rolled into the canonical number of the SAME
 *     name. Because a number is grouped by its OWN dominant name, a lone row
 *     typed with another store's number (e.g. "7264 - ORILLIA", where 7264 is
 *     really Bradford) stays under its number and never drags the two together.
 *
 * Name typos on the RIGHT number (e.g. "BARRE - 7024") need no handling here —
 * the number is already correct, so those rows group correctly on their own.
 */

/** A journal row, reduced to what canonicalisation needs. */
export interface StoreObservation {
  storeNumber: string | null;
  hdStore: string | null;
}

/** A configured Home Depot store (from Admin → Dealers). */
export interface RegistryStore {
  number: string;
  name?: string | null;
}

export interface StoreCanon {
  /**
   * The canonical store number for a raw parsed number. Pass the row's HD Store
   * label too so an unseen number can still be matched by its name.
   */
  canonical(rawNumber: string | null | undefined, hdStore?: string | null): string | null;
  /** Best display name for a (canonical) store number. */
  nameFor(num: string): string;
  /** "7137 — Orillia", with any folded-in numbers noted: "7137 — Orillia (incl. 7124)". */
  labelFor(num: string): string;
  /** canonical number → the stray numbers rolled into it (for the audit line). */
  mergedInto: Map<string, string[]>;
}

/** Derive a readable store name from an "HD Store" label ("BARRIE - 7024" → "Barrie"). */
export function deriveStoreName(hdStoreRaw: string | null | undefined): string {
  const stripped = String(hdStoreRaw ?? '')
    .replace(/\d{3,}/g, '') // drop the store number
    .replace(/[-–—#]/g, ' ') // separators
    .replace(/\bstore\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  return stripped
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build the canonicaliser from a set of journal observations and the configured
 * store registry. Pure (no I/O) so it can be unit-tested.
 */
export function computeStoreCanon(obs: StoreObservation[], registry: RegistryStore[]): StoreCanon {
  const configuredName = new Map<string, string>(); // num → configured name
  const configuredSet = new Set<string>();
  for (const r of registry) {
    const num = (r.number ?? '').trim();
    if (!num) continue;
    configuredSet.add(num);
    const nm = (r.name ?? '').trim();
    if (nm && !configuredName.has(num)) configuredName.set(num, nm);
  }

  // Tally deals per number and the names each number is written under.
  const countByNumber = new Map<string, number>();
  const nameCounts = new Map<string, Map<string, number>>(); // num → (derivedName → count)
  for (const o of obs) {
    const num = (o.storeNumber ?? '').trim();
    if (!num) continue;
    countByNumber.set(num, (countByNumber.get(num) ?? 0) + 1);
    const nm = deriveStoreName(o.hdStore);
    if (nm) {
      let m = nameCounts.get(num);
      if (!m) {
        m = new Map();
        nameCounts.set(num, m);
      }
      m.set(nm, (m.get(nm) ?? 0) + 1);
    }
  }

  // Make sure configured stores are present even if they have no deals yet.
  for (const num of configuredSet) if (!countByNumber.has(num)) countByNumber.set(num, 0);

  const dominantName = (num: string): string => {
    const configured = configuredName.get(num);
    if (configured) return configured;
    const m = nameCounts.get(num);
    if (!m) return '';
    let best = '';
    let bestN = -1;
    for (const [nm, n] of m) {
      if (n > bestN) {
        best = nm;
        bestN = n;
      }
    }
    return best;
  };

  // Group numbers by their dominant name, then pick the canonical number per name.
  const numbersByName = new Map<string, string[]>();
  for (const num of countByNumber.keys()) {
    const nn = normName(dominantName(num));
    if (!nn) continue;
    const arr = numbersByName.get(nn);
    if (arr) arr.push(num);
    else numbersByName.set(nn, [num]);
  }

  const nameCanonical = new Map<string, string>(); // normName → canonical number
  for (const [nn, nums] of numbersByName) {
    const configuredHere = nums.filter((n) => configuredSet.has(n));
    const pool = configuredHere.length ? configuredHere : nums;
    // Highest deal count wins; ties broken by the lower store number for stability.
    let canon = pool[0];
    for (const n of pool) {
      const cn = countByNumber.get(n) ?? 0;
      const cc = countByNumber.get(canon) ?? 0;
      if (cn > cc || (cn === cc && n < canon)) canon = n;
    }
    nameCanonical.set(nn, canon);
  }

  // Resolve every observed/configured number to its canonical, recording merges.
  const remap = new Map<string, string>();
  const mergedInto = new Map<string, string[]>();
  const resolve = (num: string): string => {
    if (configuredSet.has(num)) return num; // authoritative — never folded away
    const nn = normName(dominantName(num));
    if (!nn) return num;
    const canon = nameCanonical.get(nn);
    return canon && canon !== num ? canon : num;
  };
  for (const num of countByNumber.keys()) {
    const canon = resolve(num);
    remap.set(num, canon);
    if (canon !== num) {
      const list = mergedInto.get(canon);
      if (list) list.push(num);
      else mergedInto.set(canon, [num]);
    }
  }
  for (const list of mergedInto.values()) list.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const nameFor = (num: string): string => configuredName.get(num) || dominantName(num) || '';

  const canonical = (rawNumber: string | null | undefined, hdStore?: string | null): string | null => {
    const raw = (rawNumber ?? '').trim();
    if (!raw) return null;
    const known = remap.get(raw);
    if (known) return known;
    // A number we never saw while building (a store with no deals in this read):
    // fall back to a name match off the label, else keep it as-is.
    if (configuredSet.has(raw)) return raw;
    const nn = normName(deriveStoreName(hdStore));
    const canon = nn ? nameCanonical.get(nn) : undefined;
    return canon && canon !== raw ? canon : raw;
  };

  const labelFor = (num: string): string => {
    const nm = nameFor(num);
    const base = nm ? `${num} — ${nm}` : num;
    const merged = mergedInto.get(num);
    return merged && merged.length ? `${base} (incl. ${merged.join(', ')})` : base;
  };

  return { canonical, nameFor, labelFor, mergedInto };
}

let _canon: { at: number; value: StoreCanon } | null = null;
const CANON_TTL_MS = 5 * 60 * 1000;

/**
 * Load the canonicaliser from every journal year plus the configured store
 * registry. Built from ALL years so the same roll-up applies no matter what
 * date window a report asks for. Cached briefly (the journals change slowly, and
 * readJournal is itself cached).
 */
export async function loadStoreCanon(force = false): Promise<StoreCanon> {
  const now = Date.now();
  if (!force && _canon && now - _canon.at < CANON_TTL_MS) return _canon.value;

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = EARLIEST_JOURNAL_YEAR; y <= currentYear; y += 1) years.push(y);

  const [reads, offices] = await Promise.all([
    Promise.all(years.map((y) => readJournal(y))),
    listReportOffices(),
  ]);

  const obs: StoreObservation[] = [];
  for (const r of reads) {
    for (const d of r.deals) {
      if (d.result === 'RB') continue; // cancelled rows don't define a store
      obs.push({ storeNumber: d.storeNumber, hdStore: d.hdStore });
    }
  }

  const registry: RegistryStore[] = [];
  for (const o of offices) {
    for (const [number, name] of Object.entries(o.storeNames)) registry.push({ number, name });
    for (const number of o.storeNumbers) if (!o.storeNames[number]) registry.push({ number });
  }

  const value = computeStoreCanon(obs, registry);
  _canon = { at: now, value };
  return value;
}

/** Drop the cached canonicaliser (used by tests / after a journal refresh). */
export function clearStoreCanonCache(): void {
  _canon = null;
}
