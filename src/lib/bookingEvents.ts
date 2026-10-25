import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from './db';
import { recordOptOut } from './leadText';

/**
 * Receive richer booking activity streamed back from the booking app
 * (POST /api/intake/booking-event): appointments, installs, service visits and
 * opt-outs. Booking owns the data; the portal stores and displays it so booking
 * activity is never invisible on the deal side.
 *
 * Reference is loose on purpose (`portalRef` = whatever id booking was given — a
 * ScannedLead id for a lead it's working, an Application id for a sold customer),
 * resolved at display time rather than a hard FK, since one id space spans two
 * portal models. Idempotent on `eventId` (booking repeats the same id on a
 * re-send). Opt-outs are applied to the portal's SMS opt-out list, not stored as
 * events (add-only — most-restrictive-wins, never a silent re-opt-in).
 */

export type BookingEventType = 'appointment' | 'install' | 'service' | 'optout';

/** One event as the booking app sends it (loose — extra fields ride in payload). */
export interface BookingEventPayload {
  eventId?: string | null;
  type?: string | null;
  /** The portal id booking was given (ScannedLead id or Application id). */
  applicationId?: string | null;
  phoneLast4?: string | null;
  stage?: string | null;
  outcome?: string | null;
  // appointment: startAt, ranAt, saleAmountCents, soldUnits, repName
  // install: installDate, installerName
  // service: kind, date, note
  // optout: channel (sms|calls|all), optedOut, reason
  [k: string]: unknown;
}

export type BookingEventOutcome = {
  eventId: string;
  outcome: 'stored' | 'duplicate' | 'optout_applied' | 'optout_noop' | 'skipped' | 'rejected';
  detail?: string;
};

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return s || null;
}

function parseDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Last 4 digits of a phone, or null. */
export function last4(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export interface NormalizedBookingEvent {
  eventId: string;
  type: BookingEventType;
  portalRef: string | null;
  phoneLast4: string | null;
  stage: string | null;
  outcome: string | null;
  occurredAt: Date | null;
  payload: BookingEventPayload;
}

/**
 * Validate + normalise one event. Pure (no I/O) so it can be unit-tested. The
 * `occurredAt` is pulled from the type's own date field (appointment ran/start,
 * install date, service date). Returns null when the envelope is unusable.
 */
export function normalizeBookingEvent(raw: BookingEventPayload): NormalizedBookingEvent | null {
  const eventId = str(raw?.eventId);
  const typeStr = str(raw?.type)?.toLowerCase();
  if (!eventId || !typeStr) return null;
  if (typeStr !== 'appointment' && typeStr !== 'install' && typeStr !== 'service' && typeStr !== 'optout') return null;
  const type = typeStr as BookingEventType;

  const occurredAt =
    type === 'appointment' ? parseDate(raw.ranAt) ?? parseDate(raw.startAt)
    : type === 'install' ? parseDate(raw.installDate)
    : type === 'service' ? parseDate(raw.date)
    : null;

  return {
    eventId,
    type,
    portalRef: str(raw?.applicationId),
    phoneLast4: str(raw?.phoneLast4),
    stage: str(raw?.stage),
    outcome: str(raw?.outcome),
    occurredAt,
    payload: raw,
  };
}

/** Resolve a portalRef (ScannedLead id, else Application id) to a phone number. */
async function resolvePhone(portalRef: string | null): Promise<string | null> {
  if (!portalRef) return null;
  const sl = await prisma.scannedLead.findUnique({ where: { id: portalRef }, select: { phone: true } });
  if (sl?.phone) return sl.phone;
  const app = await prisma.application.findUnique({ where: { id: portalRef }, select: { applicantPhone: true } });
  return app?.applicantPhone ?? null;
}

/**
 * Apply one normalised event. Opt-outs go to SmsOptOut (add-only); the three
 * activity types are stored idempotently. Fail-soft — never throws.
 */
export async function receiveBookingEvent(raw: BookingEventPayload): Promise<BookingEventOutcome> {
  const n = normalizeBookingEvent(raw);
  if (!n) return { eventId: str(raw?.eventId) ?? '', outcome: 'rejected', detail: 'missing/invalid eventId or type' };

  // Opt-out: most-restrictive-wins, add-only. Only sms|all touch the portal's SMS
  // opt-out list; `calls` is booking's own concern (the portal doesn't call).
  if (n.type === 'optout') {
    const channel = str(raw.channel)?.toLowerCase();
    const optedOut = raw.optedOut === true || raw.optedOut === 'true';
    if (!optedOut || (channel !== 'sms' && channel !== 'all')) {
      return { eventId: n.eventId, outcome: 'optout_noop', detail: `channel=${channel ?? 'none'} optedOut=${optedOut}` };
    }
    const phone = str(raw.phone) ?? (await resolvePhone(n.portalRef));
    if (!phone) return { eventId: n.eventId, outcome: 'skipped', detail: 'no phone to opt out' };
    const ok = await recordOptOut(phone, 'booking');
    return { eventId: n.eventId, outcome: ok ? 'optout_applied' : 'skipped', detail: ok ? undefined : 'phone did not normalise' };
  }

  // Activity event — idempotent on eventId.
  const existing = await prisma.bookingEvent.findUnique({ where: { eventId: n.eventId }, select: { id: true } });
  if (existing) return { eventId: n.eventId, outcome: 'duplicate' };

  const phoneLast4 = n.phoneLast4 ?? last4(await resolvePhone(n.portalRef));
  await prisma.bookingEvent.create({
    data: {
      eventId: n.eventId,
      portalRef: n.portalRef,
      phoneLast4,
      type: n.type,
      stage: n.stage,
      outcome: n.outcome,
      occurredAt: n.occurredAt,
      payload: n.payload as unknown as Prisma.InputJsonValue,
    },
  });
  return { eventId: n.eventId, outcome: 'stored' };
}

/** Batch receiver for the route. Fail-soft per item. */
export async function receiveBookingEvents(list: BookingEventPayload[]): Promise<BookingEventOutcome[]> {
  const out: BookingEventOutcome[] = [];
  for (const e of list) {
    try {
      out.push(await receiveBookingEvent(e));
    } catch (err) {
      out.push({ eventId: str(e?.eventId) ?? '', outcome: 'skipped', detail: (err as Error).message });
    }
  }
  return out;
}

/** A booking event shaped for display on a deal / customer profile. */
export interface BookingActivityItem {
  id: string;
  type: string;
  stage: string | null;
  outcome: string | null;
  occurredAt: Date | null;
  receivedAt: Date;
  payload: Record<string, unknown>;
}

/**
 * The booking activity to show for a deal/lead: events booking tied to this
 * portal id, plus any that only matched by phone (the id spaces differ between a
 * lead and its later funded deal, so phone stitches them). Most recent first.
 */
export async function bookingActivityFor(opts: {
  portalRefs?: (string | null | undefined)[];
  phone?: string | null;
}): Promise<BookingActivityItem[]> {
  const refs = (opts.portalRefs ?? []).filter((r): r is string => !!r);
  const pl4 = last4(opts.phone);
  const or: Prisma.BookingEventWhereInput[] = [];
  if (refs.length) or.push({ portalRef: { in: refs } });
  if (pl4) or.push({ phoneLast4: pl4 });
  if (or.length === 0) return [];
  const rows = await prisma.bookingEvent.findMany({
    where: { OR: or },
    orderBy: [{ occurredAt: 'desc' }, { receivedAt: 'desc' }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    stage: r.stage,
    outcome: r.outcome,
    occurredAt: r.occurredAt,
    receivedAt: r.receivedAt,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}
