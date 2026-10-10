import 'server-only';
import crypto from 'crypto';
import { prisma } from './db';

/**
 * Customer self-booking (Phase 2 "request a preferred time") — server-only pieces.
 *
 * Each scanned/mail-in lead gets an unguessable bookingToken. A tokenized link
 * (/book/<token>) can be texted to the customer so they can request a preferred
 * day + time window themselves, 24/7, instead of waiting for a call. A booker
 * still confirms the exact time — this captures the request and surfaces it.
 *
 * The time-window labels + helpers live in `bookingWindows.ts` (client-safe);
 * re-exported here for existing server-side imports.
 */

export {
  BOOKING_WINDOWS,
  BOOKING_WINDOW_LABEL,
  BOOKING_WINDOW_SHORT,
  isBookingWindow,
  bookingRequestLabel,
  type BookingWindow,
} from './bookingWindows';

export function newBookingToken(): string {
  return crypto.randomBytes(18).toString('base64url'); // 24 url-safe chars
}

function appBase(): string {
  return (process.env.APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

export function bookingUrlFor(token: string): string {
  return `${appBase()}/book/${token}`;
}

/**
 * Return a lead's booking token, generating + saving one if it doesn't have it
 * yet (older leads created before this feature). Best-effort.
 */
export async function ensureBookingToken(leadId: string): Promise<string | null> {
  const lead = await prisma.scannedLead.findUnique({ where: { id: leadId }, select: { bookingToken: true } });
  if (!lead) return null;
  if (lead.bookingToken) return lead.bookingToken;
  const token = newBookingToken();
  try {
    await prisma.scannedLead.update({ where: { id: leadId }, data: { bookingToken: token } });
    return token;
  } catch {
    // Race on the unique token — re-read.
    const again = await prisma.scannedLead.findUnique({ where: { id: leadId }, select: { bookingToken: true } });
    return again?.bookingToken ?? null;
  }
}
