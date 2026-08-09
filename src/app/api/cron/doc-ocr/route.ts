import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runPendingOcr } from '@/lib/ocr';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled OCR of queued scans/photos (Tier 2). Point a scheduler (e.g. a
 * Render Cron Job every ~10–15 min) at this endpoint; it reads a small batch of
 * documents flagged ocrPending and extracts their text.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (running) return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });

  running = true;
  try {
    const result = await runPendingOcr(5);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] doc-ocr failed', e);
    return NextResponse.json({ error: 'OCR run failed. See server logs.' }, { status: 500 });
  } finally {
    running = false;
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
