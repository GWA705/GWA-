import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The current build's identifier, used to tell a running client (especially an
 * installed home-screen app, which caches its own snapshot) that a newer version
 * has been deployed so it can refresh. Next.js writes .next/BUILD_ID at build
 * time and it stays constant for the life of the server process, so we read it
 * once and memoize. Falls back to 'development' when the file isn't present
 * (e.g. `next dev`), which disables the auto-refresh check.
 */
let cached: string | null = null;

export function getBuildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || 'development';
  } catch {
    cached = 'development';
  }
  return cached;
}
