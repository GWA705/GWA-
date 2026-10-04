import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Admin-managed sign-in screen looks. Resolves the one login theme that should
 * show right now, if any:
 *   - a theme with a date window shows only when today (Toronto) falls inside it,
 *     and reverts on its own afterwards;
 *   - a theme with no dates is a manual always-on look (while it's active).
 * A dated theme that's in-window wins over an undated one, so you can schedule an
 * occasion over a standing look. The date math is pure + exported for unit tests.
 */

export interface ResolvedLoginTheme {
  id: string;
  name: string;
  /** Background image URL (authenticated-public serving route). */
  src: string;
  /** Accent colour (hex) or null to use the default. */
  accent: string | null;
}

function torontoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
// A stored date (saved at UTC midnight of the chosen calendar day) → "YYYY-MM-DD".
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Is a login theme showing today (Toronto)? Dated → inside the inclusive window; undated → always. */
export function loginThemeIsLive(t: { startsOn: Date | null; endsOn: Date | null }, now: Date = new Date()): boolean {
  if (!t.startsOn && !t.endsOn) return true; // manual always-on
  if (!t.startsOn || !t.endsOn) return false; // a half-set window never shows
  const today = torontoDate(now);
  return dateOnly(t.startsOn) <= today && today <= dateOnly(t.endsOn);
}

function themeUrl(t: { id: string; updatedAt: Date }): string {
  return `/api/login-theme/${t.id}/image?v=${t.updatedAt.getTime()}`;
}

/** Resolve the login theme to show right now, or null for the built-in look. */
export async function activeLoginTheme(now: Date = new Date()): Promise<ResolvedLoginTheme | null> {
  // The sign-in page is the front door — never let a DB hiccup (or a not-yet-run
  // migration) here break login. Any failure falls back to the built-in look.
  let rows: Awaited<ReturnType<typeof prisma.loginTheme.findMany>>;
  try {
    rows = await prisma.loginTheme.findMany({ where: { active: true }, take: 50 });
  } catch {
    return null;
  }
  const live = rows.filter((r) => loginThemeIsLive(r, now));
  if (live.length === 0) return null;

  // A scheduled (dated) theme in its window beats a standing (undated) one; within
  // each group the most recently created wins, so re-uploading just works.
  live.sort((a, b) => {
    const da = a.startsOn ? 1 : 0;
    const db = b.startsOn ? 1 : 0;
    if (da !== db) return db - da;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const top = live[0];
  return { id: top.id, name: top.name, src: themeUrl(top), accent: top.accentColor ?? null };
}
