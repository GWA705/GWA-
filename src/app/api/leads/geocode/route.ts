import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { geocodeBatch } from '@/lib/leadGeo';

export const dynamic = 'force-dynamic';

// Fill the geocode cache for the Leads map. The map sends the {key, query} pairs
// it doesn't yet have coordinates for; we geocode a capped batch (cached, so a
// key is only ever looked up once) and return whatever we could place. Signed-in
// users only; rate-limited. Results are shared cache, so no per-office scoping is
// needed here — the map only ever asks about leads it is already showing.
// Kept small because the OSM geocoder is throttled to ~1/sec, so each item adds
// ~1s to the request; 6 keeps a request well under any gateway timeout.
const MAX_PER_REQUEST = 6;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`leads-geocode:${session.userId}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ results: {} }, { status: 429 });

  let body: { items?: { key?: string; query?: string }[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ results: {} }, { status: 400 });
  }
  const items = (body.items ?? [])
    .filter((it) => it && typeof it.key === 'string' && typeof it.query === 'string')
    .slice(0, MAX_PER_REQUEST) as { key: string; query: string }[];

  const results = await geocodeBatch(items);
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'private, no-store' } });
}
