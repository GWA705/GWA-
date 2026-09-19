/**
 * Georgian Water & Air — optional blank-card reference for the lead-card scanner.
 *
 * The card reader (`leadScanner.ts`) reads noticeably better when it is shown a
 * clean, UNFILLED copy of the exact card first — a labelled "here is where each
 * field and tick-box sits" map — before the filled photo. This module loads that
 * blank reference (plus any office notes about the layout) from a committed file
 * and hands it to the scanner on every scan.
 *
 * It is entirely optional. With no blank card on disk this returns `undefined`
 * and the scanner runs exactly as it did before — so this can ship ahead of the
 * blank photo and light up the moment the photo is dropped in.
 *
 * Where the files live (both optional):
 *   assets/lead-card/blank-card.(jpg|jpeg|png|webp)   the clean, empty card photo
 *   assets/lead-card/notes.txt                        office hints about the layout
 *
 * These are plain committed files (see assets/lead-card/README.md), read from the
 * repo tree at request time — the Docker image ships the whole tree, so they are
 * present at runtime in `ca-central-1` just as they are in local dev.
 *
 * Escape hatch: set LEAD_CARD_TEMPLATE_DISABLED=1 to ignore the files and run the
 * scanner without the reference, without deleting anything.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CardTemplate } from './leadScanner';

const DIR = path.join(process.cwd(), 'assets', 'lead-card');

// Accepted blank-card filenames, most-preferred first. One is enough.
const IMAGE_FILES = ['blank-card.jpg', 'blank-card.jpeg', 'blank-card.png', 'blank-card.webp'];
const NOTES_FILE = 'notes.txt';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Resolve once and reuse — the blank card doesn't change between requests, and a
// missing file shouldn't be re-checked on every scan. A redeploy re-reads it.
let cached: Promise<CardTemplate | undefined> | null = null;

async function readImage(): Promise<CardTemplate['image']> {
  for (const name of IMAGE_FILES) {
    try {
      const buffer = await fs.readFile(path.join(DIR, name));
      if (buffer.length === 0) continue;
      const mime = MIME_BY_EXT[path.extname(name).toLowerCase()] ?? 'image/jpeg';
      return { buffer, mime };
    } catch {
      // Not this filename — try the next.
    }
  }
  return undefined;
}

async function readNotes(): Promise<string | undefined> {
  try {
    const notes = (await fs.readFile(path.join(DIR, NOTES_FILE), 'utf8')).trim();
    return notes || undefined;
  } catch {
    return undefined;
  }
}

async function load(): Promise<CardTemplate | undefined> {
  if (process.env.LEAD_CARD_TEMPLATE_DISABLED === '1') return undefined;

  const [image, notes] = await Promise.all([readImage(), readNotes()]);
  // Nothing to add — behave exactly as before.
  if (!image && !notes) return undefined;
  return { image, notes };
}

/**
 * The blank-card reference to pass as `extractCard`/`extractCardsFromImage`'s
 * `template`, or `undefined` when none is configured. Never throws — a read
 * failure just means "no reference", so a missing/renamed file can never break a
 * scan.
 */
export function getLeadCardTemplate(): Promise<CardTemplate | undefined> {
  if (!cached) {
    cached = load().catch(() => undefined);
  }
  return cached;
}
