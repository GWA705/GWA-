import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { autocompleteAddress } from '@/lib/googlePlaces';

export const dynamic = 'force-dynamic';

// Server-side address autocomplete proxy — keeps the Google key off the browser.
// Signed-in users only; rate-limited to blunt abuse.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`places-ac:${session.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ predictions: [] }, { status: 429 });

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const token = req.nextUrl.searchParams.get('token') ?? undefined;
  const predictions = await autocompleteAddress(q, token);
  return NextResponse.json({ predictions }, { headers: { 'Cache-Control': 'private, no-store' } });
}
