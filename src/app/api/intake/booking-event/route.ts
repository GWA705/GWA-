import { NextResponse } from 'next/server';
import { peerToken, bearerMatches } from '@/lib/portalPeer';
import { receiveBookingEvents, type BookingEventPayload } from '@/lib/bookingEvents';

export const dynamic = 'force-dynamic';

/**
 * Booking → portal activity feed.
 *
 * The booking app posts richer activity here as it happens: appointments
 * (booked → ran → sold), installs, service visits, and opt-outs — so the office
 * sees what bookers did without leaving the portal. Companion to the coarse
 * status mirror (/api/intake/booking-status); this one carries the detail.
 *
 * Shared-secret auth (PORTAL_INTAKE_TOKEN) — the caller is the booking server,
 * not a person. Idempotent on each event's `eventId`; opt-outs are add-only.
 * Fail-soft and inert until the shared token is configured.
 */

const MAX_BYTES = 256 * 1024;
const MAX_EVENTS = 100;

function authorise(req: Request): NextResponse | null {
  const expected = peerToken();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'The booking event feed is not switched on here.' }, { status: 503 });
  }
  if (!bearerMatches(req, expected)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/** Reachability check for the booking side's setup step. */
export async function GET(req: Request) {
  const denied = authorise(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true, feed: 'BOOKING_EVENT' });
}

export async function POST(req: Request) {
  const denied = authorise(req);
  if (denied) return denied;

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Payload too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Payload too large.' }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  // Accept one event or a batch, so booking can post as things happen or sweep a
  // backlog without two code paths.
  const raw = body as { events?: unknown } | unknown;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { events?: unknown })?.events)
      ? ((raw as { events: unknown[] }).events)
      : [raw];

  const events = list.filter((e): e is BookingEventPayload => !!e && typeof e === 'object');
  if (events.length === 0) {
    return NextResponse.json({ ok: false, error: 'No events in the body.' }, { status: 400 });
  }
  if (events.length > MAX_EVENTS) {
    return NextResponse.json({ ok: false, error: `Send at most ${MAX_EVENTS} events at a time.` }, { status: 400 });
  }

  const results = await receiveBookingEvents(events);
  return NextResponse.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
}
