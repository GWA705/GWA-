import { NextResponse } from 'next/server';

// Liveness probe for the hosting platform (Render health check). Intentionally
// does not touch the database so it reports process health, not dependencies.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ status: 'ok' });
}
