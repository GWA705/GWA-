import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { processDueLeadTexts } from '@/lib/leadText';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Send the due, in-window customer "we received your request" auto-texts.
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Meant to run on a short schedule
 * (e.g. every 15 min) like the other portal crons. Inert until the feature is
 * enabled in settings; respects test mode, the daytime window, and opt-outs.
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
    const counts = await processDueLeadTexts();
    return NextResponse.json({ ok: true, ...counts });
  } catch (e) {
    console.error('[lead-text-sweep] failed', e);
    return NextResponse.json({ error: 'sweep failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// GET supported too, so a simple cron `curl` with a Bearer header works.
export async function GET(req: NextRequest) {
  return handle(req);
}
