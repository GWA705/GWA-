import { NextRequest, NextResponse } from 'next/server';
import { runAttentionAlerts } from '@/lib/sla';

export const dynamic = 'force-dynamic';

/**
 * Scheduled endpoint for the 2-hour "new deal not looked at" alert. Meant to be
 * called by a scheduler (e.g. a Render Cron Job) every ~15 minutes. Protected by
 * a shared secret so it can't be triggered by the public.
 *
 * Auth: send the secret as either
 *   Authorization: Bearer <CRON_SECRET>
 * or a query string ?key=<CRON_SECRET>
 *
 * The function itself only sends during business hours (8am–10pm Ontario time),
 * so running the cron all day is fine — off-hours runs simply no-op.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const key = bearer || req.nextUrl.searchParams.get('key') || '';
  if (key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAttentionAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] attention-alerts failed', e);
    return NextResponse.json({ ok: false, error: 'Alert run failed.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
