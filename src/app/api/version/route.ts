import { NextResponse } from 'next/server';
import { getBuildId } from '@/lib/version';

// Reports the running build id so clients can detect a new deploy and refresh.
// Never cached — the whole point is to see the current server's build.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { buildId: getBuildId() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
