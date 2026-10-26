import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sweepHdRemittances, type RemittanceSyncResult } from '@/lib/hdRemittanceSync';
import { gmailReadConfigured } from '@/lib/gmailClient';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

let running = false;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Email the team when a remittance couldn't be auto-processed (needs manual review). */
async function alertOnFailures(r: RemittanceSyncResult): Promise<void> {
  const failures = r.details.filter((d) => d.status !== 'processed' && d.status !== 'duplicate');
  if (failures.length === 0) return;
  const to = process.env.REMITTANCE_ALERT_EMAIL || process.env.GMAIL_RESOLUTION_USER || 'sean@ghsbarrie.ca';
  const rows = failures
    .map((d) => `<li><b>${d.status}</b>${d.documentNumber ? ` — doc ${d.documentNumber}` : ''}${d.error ? `: ${d.error}` : ''}</li>`)
    .join('');
  await sendEmail({
    to,
    subject: `⚠ HD remittance needs manual review — ${failures.length} not auto-processed`,
    html: `<p>The portal auto-pull could not process ${failures.length} Home Depot remittance item(s). These were <b>not funded</b> — please process them by hand in Staff → Remittances.</p><ul>${rows}</ul>`,
  }).catch((e) => console.error('[cron] hd-remittance-sync alert failed', e));
}

/**
 * Scheduled auto-pull of Home Depot remittances into the portal (replaces the
 * Google Apps Script). Reads the HD "Remittance Advice" emails, parses the PDF
 * text in-portal (no OCR), and funds matched deals — idempotent by HD document
 * number, so running it repeatedly is safe. Inert until Gmail read access is
 * configured (same delegation as HD Resolution).
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

  if (!gmailReadConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'Gmail read access is not configured' });
  }
  if (running) return NextResponse.json({ ok: true, skipped: 'a run is already in progress' });
  running = true;
  void sweepHdRemittances()
    .then(async (r) => {
      console.log('[cron] hd-remittance-sync', JSON.stringify(r));
      await alertOnFailures(r);
    })
    .catch((e) => console.error('[cron] hd-remittance-sync failed', e))
    .finally(() => { running = false; });
  return NextResponse.json({ ok: true, started: true });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
