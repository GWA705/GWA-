import 'server-only';
import { prisma } from '@/lib/db';
import { HERO_SLOT_HOURS, hourFromHeroPath } from '@/lib/heroSlots';

/**
 * Admin-managed dashboard heroes. Resolves, for right now:
 *   - the uploaded image(s) for each time slot (which override the file-based
 *     public/hero-<hour>.webp defaults), and
 *   - the active special-occasion hero, if today falls in one's date window.
 * The date math is pure + exported so it can be unit tested.
 */

export type HeroScope = 'ALL' | 'NIGHT';

export interface ResolvedHeroState {
  /** Uploaded hero image URLs per slot start hour. */
  slotImages: Record<number, string[]>;
  /** The special occasion taking over right now, or null. */
  special: { src: string; scope: HeroScope } | null;
}

function torontoDate(d: Date): string {
  // en-CA with these options yields "YYYY-MM-DD".
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
// A stored date (saved at UTC midnight of the chosen calendar day) → "YYYY-MM-DD".
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Is a special occasion showing today (Toronto)? Both dates set → inside the
 * inclusive window. No dates at all → always on (runs until it's turned off). A
 * half-set window (only one date) never shows.
 */
export function specialIsLive(s: { startsOn: Date | null; endsOn: Date | null }, now: Date = new Date()): boolean {
  if (!s.startsOn && !s.endsOn) return true; // always-on until turned off
  if (!s.startsOn || !s.endsOn) return false; // half-set never shows
  const today = torontoDate(now);
  return dateOnly(s.startsOn) <= today && today <= dateOnly(s.endsOn);
}

function heroUrl(h: { id: string; updatedAt: Date }): string {
  return `/api/dashboard-hero/${h.id}/image?v=${h.updatedAt.getTime()}`;
}

/** Resolve the current uploaded-hero state (slot overrides + active special). */
export async function dashboardHeroState(now: Date = new Date()): Promise<ResolvedHeroState> {
  const rows = await prisma.dashboardHero.findMany({ where: { active: true }, take: 200 });

  const slotImages: Record<number, string[]> = {};
  for (const r of rows) {
    if (r.kind === 'SLOT' && r.slotHour != null) {
      (slotImages[r.slotHour] ??= []).push(heroUrl(r));
    }
  }

  const liveSpecials = rows
    .filter((r) => r.kind === 'SPECIAL' && specialIsLive(r, now))
    // A scheduled (dated) special in its window beats a standing (always-on) one;
    // within each group the most recently created wins.
    .sort((a, b) => {
      const da = a.startsOn ? 1 : 0;
      const db = b.startsOn ? 1 : 0;
      if (da !== db) return db - da;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  const top = liveSpecials[0];
  const special = top ? { src: heroUrl(top), scope: (top.scope === 'NIGHT' ? 'NIGHT' : 'ALL') as HeroScope } : null;

  return { slotImages, special };
}

/**
 * Merge uploaded slot heroes over the file-based defaults, per slot. An uploaded
 * hero for a slot replaces the file default for that slot; slots with no upload
 * keep their file hero.
 */
export function mergeSlotImages(fileHeroes: string[], uploaded: Record<number, string[]>): Record<number, string[]> {
  const fileBySlot: Record<number, string[]> = {};
  for (const p of fileHeroes) {
    const h = hourFromHeroPath(p);
    if (h != null) (fileBySlot[h] ??= []).push(p);
  }
  const out: Record<number, string[]> = {};
  for (const hour of HERO_SLOT_HOURS) {
    out[hour] = uploaded[hour]?.length ? uploaded[hour] : (fileBySlot[hour] ?? []);
  }
  return out;
}
