import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { recompressOversizedBatch } from '@/lib/recompress';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * One-off backfill sweep: re-compress a batch of the biggest oversized stored
 * scans across ALL deals (files uploaded before the resolution cap existed), so
 * their previews and downloads get fast too. Drains the backlog a batch at a
 * time; once every file is under the threshold it no-ops (the upload cap keeps
 * new ones small, so the backlog never regrows). Safe to leave scheduled.
 *
 * Point a scheduler at this endpoint. Auth: Authorization: Bearer <CRON_SECRET>
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

  // Fire-and-forget: a batch can take longer than the CloudFront origin timeout,
  // which would 504 the caller (a false cron failure) even though the work keeps
  // running on the server. So kick it off and return immediately; the sweep is
  // resumable (processed docs are marked), so nothing is lost or repeated.
  // (Same pattern as doc-ocr.) Peak memory is ~one document (sequential).
  running = true;
  void recompressOversizedBatch(40, null)
    .then((r) => console.log('[cron] recompress', r))
    .catch((e) => console.error('[cron] recompress failed', e))
    .finally(() => {
      running = false;
    });
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
