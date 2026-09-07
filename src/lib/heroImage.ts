import 'server-only';
import { readdir } from 'fs/promises';
import path from 'path';

/**
 * Rotating dashboard hero. Drop a few images into `public/hero/` and the
 * dashboard shows a different one each day (deterministic — everyone sees the
 * same one on a given day, and it changes daily so it never feels stale). No
 * external calls; falls back to the single `public/hero-banner.webp` (then the
 * gradient) when the folder is empty.
 */

const IMG = /\.(png|jpe?g|webp|avif)$/i;

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

// Time-of-day dashboard hero files live in `public/` named `hero-<hour>.png`
// (e.g. Hero-12.png, hero-15.png). This deliberately matches `hero-<digit>` so
// the page heroes (`marketplace-hero.webp`, …) and the default `hero-banner.webp`
// are NOT treated as time-of-day images.
const TIME_HERO = /^hero-\d/i;

/**
 * Time-of-day dashboard hero images from `public/`, sorted, as web paths. The
 * client (HeroBackdrop) picks the one whose hour matches the current slot
 * (5, 12, 15, 17, 19, 21, 23) and crossfades; `hero-banner.webp` is the default
 * for any slot without its own image.
 */
export async function listHeroImages(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), 'public');
    return (await readdir(dir))
      .filter((f) => IMG.test(f) && TIME_HERO.test(f))
      .sort()
      .map((f) => `/${f}`);
  } catch {
    return [];
  }
}

export async function pickHeroImage(): Promise<string> {
  try {
    const dir = path.join(process.cwd(), 'public', 'hero');
    const files = (await readdir(dir)).filter((f) => IMG.test(f)).sort();
    if (files.length === 0) return '/hero-banner.webp';
    const idx = dayOfYear() % files.length;
    return `/hero/${files[idx]}`;
  } catch {
    return '/hero-banner.webp';
  }
}
