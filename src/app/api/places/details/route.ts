import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { placeDetails } from '@/lib/googlePlaces';

export const dynamic = 'force-dynamic';

// Server-side place-details proxy — resolves a selected prediction into address
// fields without exposing the Google key. Signed-in users only; rate-limited.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`places-det:${session.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ details: null }, { status: 429 });

  const placeId = req.nextUrl.searchParams.get('placeId') ?? '';
  const token = req.nextUrl.searchParams.get('token') ?? undefined;
  const details = await placeDetails(placeId, token);
  return NextResponse.json({ details }, { headers: { 'Cache-Control': 'private, no-store' } });
}
