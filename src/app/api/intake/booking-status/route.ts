import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { peerToken, bearerMatches } from '@/lib/portalPeer';

export const dynamic = 'force-dynamic';

/**
 * Booking -> portal status mirror.
 *
 * When a booker moves a lead in the booking system (booked, sold, dead, …), the
 * booking app posts the new status here so the office sees it on the scanned
 * lead — booking activity is never invisible in the portal. Booking owns this
 * value; we only store and display it, so it never fights the office's own
 * status field.
 *
 * Shared-secret auth (PORTAL_INTAKE_TOKEN) — the caller is the booking server,
 * not a person. Writes straight to the row (no outbound push back), so a mirror
 * update can never bounce back to booking.
 */
export async function POST(req: Request) {
  const expected = peerToken();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'The booking status feed is not switched on here.' }, { status: 503 });
  }
  if (!bearerMatches(req, expected)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const b = body as { applicationId?: unknown; status?: unknown };
  const applicationId = String(b.applicationId ?? '').trim();
  const status = String(b.status ?? '').trim().slice(0, 40);
  if (!applicationId || !status) {
    return NextResponse.json({ ok: false, error: 'applicationId and status are required.' }, { status: 400 });
  }

  // Only scanned leads carry a booking mirror. A no-match is a soft ok — the
  // booking lead may not have come from a scanned card.
  const res = await prisma.scannedLead.updateMany({
    where: { id: applicationId },
    data: { bookingStatus: status, bookingStatusAt: new Date() },
  });

  return NextResponse.json({ ok: true, updated: res.count }, { headers: { 'Cache-Control': 'no-store' } });
}
