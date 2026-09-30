import 'server-only';
import { timingSafeEqual } from 'crypto';

/**
 * Shared-secret auth for the booking system talking to the portal (booking ->
 * portal status mirror, and booking fetching a scanned card's photo). It's the
 * SAME secret the portal signs its own posts to booking with (PORTAL_INTAKE_TOKEN),
 * so one value covers both directions. Absent means the door is shut.
 */
export function peerToken(): string | null {
  return process.env.PORTAL_INTAKE_TOKEN?.trim() || null;
}

/** Constant-time check of a request's bearer (or x-intake-token) against the secret. */
export function bearerMatches(req: Request, expected: string): boolean {
  const header = req.headers.get('authorization') ?? '';
  const presented = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : (req.headers.get('x-intake-token') ?? '').trim();
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
