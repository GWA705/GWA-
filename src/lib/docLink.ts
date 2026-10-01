// Secure, expiring download links for Product Library files (manuals /
// brochures) emailed to customers. A token is a tamper-proof, self-contained
// encrypted blob of { fileId, exp } — no new table and no new secret: it rides
// the app's existing encryption key. The public /d/[token] route validates it
// and streams the file, so large manuals that are too big to attach can still
// be sent. Expired or altered tokens simply don't decrypt to a valid payload.

import { encryptString, decryptString } from '@/lib/crypto';

export const DOC_LINK_TTL_DAYS = 30;

/** Mint a download token for one library file, valid for `ttlDays` days. */
export function makeDocLinkToken(fileId: string, ttlDays: number = DOC_LINK_TTL_DAYS): string {
  const exp = Date.now() + Math.max(1, ttlDays) * 24 * 60 * 60 * 1000;
  return encryptString(JSON.stringify({ f: fileId, exp }));
}

/** Validate a token; returns the fileId when valid and unexpired, else null. */
export function readDocLinkToken(token: string): { fileId: string } | null {
  try {
    const data = JSON.parse(decryptString(token)) as { f?: unknown; exp?: unknown };
    if (typeof data.f !== 'string' || !data.f) return null;
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;
    return { fileId: data.f };
  } catch {
    return null;
  }
}
