/**
 * Marketplace "New Arrivals" spotlight — automatic weekly rotation.
 *
 * The showcase rail should never go stale and shouldn't need anyone to curate it
 * by hand. This picks the spotlight set deterministically from the catalogue:
 *
 *   1. Genuinely new items (added within `freshDays`) are always shown, and get an
 *      automatic "New" badge for that window — so a freshly uploaded product shows
 *      up immediately and the badge falls off on its own later.
 *   2. Admin-pinned items (`featured = true`) are always shown.
 *   3. The rest of the rail is filled from the back catalogue with a selection that
 *      rotates every ISO week — so different items get their turn automatically,
 *      the same for everyone within a week, changing on its own at the week boundary.
 *
 * Pure + dependency-free (no `server-only`) so it's unit-testable and the page can
 * call it at render time — no cron, no DB writes, can't drift or fail silently.
 */

export interface SpotlightConfig {
  enabled: boolean;
  targetCount: number; // how many items to show in the rail
  freshDays: number; // an item this new is always shown + auto-"New"
}

export const SPOTLIGHT_DEFAULTS: SpotlightConfig = { enabled: true, targetCount: 6, freshDays: 21 };

export interface SpotlightItem {
  id: string;
  createdAt: Date | number;
  featured: boolean;
  tags: string[];
}

export interface SpotlightResult {
  ids: Set<string>; // items that belong in the rail this week
  autoNew: Set<string>; // fresh items that should get an automatic "New" badge
}

/** Stable per-ISO-week seed (UTC): year*100 + week number. Changes weekly. */
export function isoWeekSeed(now: Date): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday — ISO week anchor
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

// Small deterministic string hash (FNV-1a) → used to order the rotating pool.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toMs(c: Date | number): number {
  return typeof c === 'number' ? c : c.getTime();
}

/**
 * Compute this week's spotlight set from the active items.
 * When disabled, falls back to exactly the admin-pinned (`featured`) items, so
 * turning the automation off restores manual curation with no surprises.
 */
export function pickSpotlight(items: SpotlightItem[], now: Date, cfg: SpotlightConfig): SpotlightResult {
  if (!cfg.enabled) {
    return { ids: new Set(items.filter((i) => i.featured).map((i) => i.id)), autoNew: new Set() };
  }

  const freshMs = Math.max(0, cfg.freshDays) * 86400000;
  const nowMs = now.getTime();

  const fresh = items.filter((i) => nowMs - toMs(i.createdAt) <= freshMs);
  const freshIds = new Set(fresh.map((i) => i.id));
  const pinned = items.filter((i) => i.featured && !freshIds.has(i.id));

  // Fresh + pinned are always in; never hide a new or deliberately-featured item.
  const chosen = new Set<string>([...freshIds, ...pinned.map((i) => i.id)]);

  const target = Math.max(0, Math.floor(cfg.targetCount));
  if (chosen.size < target) {
    // Rotating window: a stable per-item order, advanced by the week seed. Each
    // week the window starts one step further along, so the filler moves on its
    // own and every item in the back catalogue gets its turn over time.
    const pool = items.filter((i) => !chosen.has(i.id)).sort((a, b) => hash(a.id) - hash(b.id));
    if (pool.length > 0) {
      const start = isoWeekSeed(now) % pool.length;
      for (let k = 0; chosen.size < target && k < pool.length; k++) {
        chosen.add(pool[(start + k) % pool.length].id);
      }
    }
  }

  const autoNew = new Set(fresh.filter((i) => !i.tags.includes('NEW')).map((i) => i.id));
  return { ids: chosen, autoNew };
}
