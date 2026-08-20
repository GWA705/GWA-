import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import {
  readLeads,
  dealerStoreNumbers,
  findLeadByBooking,
  parseLeadName,
  parseLeadAddress,
} from '@/lib/leads';

export const dynamic = 'force-dynamic';

/**
 * Look up an HD lead by its booking number (701…) so the new-application form
 * can pre-fill the customer's details. Signed-in users only; a dealer only sees
 * leads for their own store(s) — the same scope as their Leads page.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`lead-lookup:${session.userId}`, 40, 60);
  if (!rl.ok) return NextResponse.json({ found: false, error: 'Too many lookups — wait a moment.' }, { status: 429 });

  const booking = (req.nextUrl.searchParams.get('booking') ?? '').trim();
  if (booking.replace(/\D/g, '').length < 4) return NextResponse.json({ found: false });

  const read = await readLeads();
  if (!read.configured) return NextResponse.json({ found: false, error: 'Leads are not connected.' });
  if (read.error) return NextResponse.json({ found: false, error: read.error });

  const lead = findLeadByBooking(read.leads, booking);
  if (!lead) return NextResponse.json({ found: false });

  // Dealer scope: only their own store's leads (mirrors the Leads page). Staff
  // (no dealerId) can look up any lead.
  if (session.dealerId) {
    const stores = await dealerStoreNumbers(session.dealerId);
    if (stores.length > 0 && !stores.includes(lead.storeNumber)) {
      return NextResponse.json({ found: false, reason: 'not-your-store' });
    }
  }

  const name = parseLeadName(lead.customerName);
  const addr = parseLeadAddress(lead.address);
  return NextResponse.json(
    {
      found: true,
      lead: {
        bookingId: lead.bookingId,
        customerName: lead.customerName,
        firstName: name.first,
        lastName: name.last,
        phone: lead.phone,
        email: lead.email,
        street: addr.street,
        city: addr.city,
        province: addr.province,
        postal: addr.postal,
        storeNumber: lead.storeNumber,
        service: lead.service,
        additionalInfo: lead.additionalInfo,
        noGood: lead.noGood,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
