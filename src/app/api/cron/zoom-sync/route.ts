import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { syncZoomRecordings } from '@/lib/zoomSync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sync recent Zoom cloud recordings into the review queue.
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Inert until Zoom credentials are
 * configured. Safe to run a few times a day.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncZoomRecordings();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[zoom-sync] failed', e);
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}
