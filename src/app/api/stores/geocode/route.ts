import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { geocodeStoresByIds } from '@/lib/leadGeo';

export const dynamic = 'force-dynamic';

// Place Home Depot stores on the Leads map. The map sends the ids of stores that
// aren't placed yet; we geocode a small (throttled) batch by name, save the
// coordinates on each store, and return the ones now placed. Staff can place any
// store; a dealer only ever places their own office's stores.
const MAX_PER_REQUEST = 6;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`stores-geocode:${session.userId}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ stores: [] }, { status: 429 });

  let body: { ids?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ stores: [] }, { status: 400 });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, MAX_PER_REQUEST)
    : [];

  // Dealers are scoped to their own office; reviewers/admins can place any store.
  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  const scopeDealerId = isStaff ? undefined : session.dealerId || '__none__';

  const stores = await geocodeStoresByIds(ids, scopeDealerId);
  return NextResponse.json({ stores }, { headers: { 'Cache-Control': 'private, no-store' } });
}
