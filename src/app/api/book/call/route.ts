import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { placeClickToCall } from '@/lib/voice';
import { provinceFromPostalCode, cancelLeadFollowups } from '@/lib/leadText';
import { rateLimit } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public "connect me to a booker now" from the self-booking page. Token-gated and
 * rate-limited; it only ever dials the number already stored on the lead (never a
 * number from the request), so it can't be used to ring arbitrary people. On a
 * non-ok result the page falls back to recording a call-back request.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }
  const token = String(body.token || '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'invalid link' }, { status: 400 });

  // Calls cost money and ring a person — keep this tight.
  const rl = await rateLimit(`book-call:${token}`, 4, 600);
  if (!rl.ok) return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });

  const lead = await prisma.scannedLead.findUnique({
    where: { bookingToken: token },
    select: { id: true, phone: true, postalCode: true },
  });
  if (!lead || !lead.phone) return NextResponse.json({ ok: false, error: 'invalid link' }, { status: 400 });

  const province = provinceFromPostalCode(lead.postalCode);
  const result = await placeClickToCall({ customerPhone: lead.phone, province });
  if (!result.ok) {
    // 200 with ok:false so the page can fall back gracefully (after-hours, etc.).
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  await prisma.scannedLead.update({ where: { id: lead.id }, data: { bookingCallNow: true, bookingRequestedAt: new Date() } });
  await cancelLeadFollowups(`s:${lead.id}`);
  await audit({ actorId: null, action: 'STATUS_CHANGE', entityType: 'ScannedLead', entityId: lead.id, detail: 'Customer self-booking: live call connected' });

  return NextResponse.json({ ok: true });
}
