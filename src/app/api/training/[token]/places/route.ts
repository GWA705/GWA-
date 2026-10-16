import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { autocompleteAddress, placeDetails } from '@/lib/googlePlaces';

export const dynamic = 'force-dynamic';

// Public (no-login) address autocomplete for the Lead Gen Training intake. Gated
// by the office's training token (so only a valid training link can use it) and
// rate-limited by IP. The Google key stays server-side. `?q=` returns address
// predictions; `?placeId=` returns the resolved street/city/postal.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const dealer = await prisma.dealer.findUnique({
    where: { trainingToken: params.token },
    select: { active: true },
  });
  if (!dealer || !dealer.active) return new NextResponse('Not found', { status: 404 });

  const ip = clientIp();
  const rl = await rateLimit(`training-places:${ip}`, 60, 60); // 60/min/IP
  if (!rl.ok) return NextResponse.json({ predictions: [], details: null }, { status: 429 });

  const sp = req.nextUrl.searchParams;
  const sessionToken = sp.get('token') ?? undefined;
  const placeId = sp.get('placeId');
  if (placeId) {
    const details = await placeDetails(placeId, sessionToken);
    return NextResponse.json({ details }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const q = sp.get('q') ?? '';
  const predictions = await autocompleteAddress(q, sessionToken);
  return NextResponse.json({ predictions }, { headers: { 'Cache-Control': 'private, no-store' } });
}
