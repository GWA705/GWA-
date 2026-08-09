import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { runDatabaseBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Prevents an overlapping run if a schedule fires while one is still writing.
let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Scheduled database export. Point a weekly scheduler (e.g. a Render Cron Job)
 * at this endpoint — it writes a single encrypted, gzipped JSON archive of every
 * table to the `db-backups/` prefix in the storage bucket.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (running) {
    return NextResponse.json({ ok: true, skipped: 'a backup is already in progress' });
  }

  running = true;
  try {
    const result = await runDatabaseBackup();
    console.log(`[cron] db-backup wrote ${result.key} (${result.rows} rows, ${result.bytes} bytes)`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cron] db-backup failed', e);
    return NextResponse.json({ error: 'Backup failed. See server logs.' }, { status: 500 });
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
