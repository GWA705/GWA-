'use server';

import { prisma } from '@/lib/db';
import { isBookingWindow } from '@/lib/bookingWindows';
import { cancelLeadFollowups } from '@/lib/leadText';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export interface BookingState { ok?: boolean; error?: string; callNow?: boolean }

/**
 * Public, no-login submit from the customer self-booking page (/book/<token>).
 * Records the customer's preferred day + window (or a "call me now" request) on
 * their lead, stops the nudge texts, and leaves a booker to confirm. Token-gated
 * and rate-limited; it never exposes any lead data back to the caller.
 */
export async function submitBookingRequestAction(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const token = String(fd.get('token') || '').trim();
  if (!token) return { error: 'This booking link is no longer valid.' };

  // Rate-limit per token so the public page can't be hammered.
  const rl = await rateLimit(`book:${token}`, 20, 300);
  if (!rl.ok) return { error: 'Too many attempts — please wait a minute and try again.' };

  const lead = await prisma.scannedLead.findUnique({
    where: { bookingToken: token },
    select: { id: true, status: true },
  });
  if (!lead) return { error: 'This booking link is no longer valid.' };

  const callNow = String(fd.get('callNow') || '') === '1';
  const day = String(fd.get('day') || '').trim().slice(0, 10) || null;
  const windowRaw = String(fd.get('window') || '').trim().toUpperCase();
  const window = isBookingWindow(windowRaw) ? windowRaw : null;
  const note = String(fd.get('note') || '').trim().slice(0, 500) || null;

  if (!callNow && !day && !window) {
    return { error: 'Pick a day and time that suits you, or choose “call me as soon as possible.”' };
  }
  if (!callNow && day) {
    const d = new Date(`${day}T00:00:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const max = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(d.getTime()) || d < today || d > max) {
      return { error: 'Please choose a day within the next two months.' };
    }
  }

  await prisma.scannedLead.update({
    where: { id: lead.id },
    data: {
      bookingRequestedAt: new Date(),
      bookingPreferredDay: callNow ? null : day,
      bookingWindow: callNow ? null : window,
      bookingCallNow: callNow,
      bookingNote: note,
    },
  });

  // They've told us their preference — stop the reminder/missed-window texts; a
  // booker takes it from here. (The lead stays "new" until a booker confirms, so
  // the SLA keeps it visible.)
  await cancelLeadFollowups(`s:${lead.id}`);

  await audit({
    actorId: null,
    action: 'STATUS_CHANGE',
    entityType: 'ScannedLead',
    entityId: lead.id,
    detail: callNow ? 'Customer self-booking: call ASAP' : `Customer self-booking: ${[day, window].filter(Boolean).join(' ')}`.trim(),
  });

  return { ok: true, callNow };
}
