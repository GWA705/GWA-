import 'server-only';
import { readdir } from 'fs/promises';
import path from 'path';

/**
 * Rotating dashboard hero. Drop a few images into `public/hero/` and the
 * dashboard shows a different one each day (deterministic — everyone sees the
 * same one on a given day, and it changes daily so it never feels stale). No
 * external calls; falls back to the single `public/hero-banner.png` (then the
 * gradient) when the folder is empty.
 */

const IMG = /\.(png|jpe?g|webp|avif)$/i;

function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export async function pickHeroImage(): Promise<string> {
  try {
    const dir = path.join(process.cwd(), 'public', 'hero');
    const files = (await readdir(dir)).filter((f) => IMG.test(f)).sort();
    if (files.length === 0) return '/hero-banner.png';
    const idx = dayOfYear() % files.length;
    return `/hero/${files[idx]}`;
  } catch {
    return '/hero-banner.png';
  }
}
