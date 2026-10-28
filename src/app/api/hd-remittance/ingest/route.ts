import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function secretMatches(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Ingest a Home Depot remittance from the Google Apps Script (or any trusted
 * caller). Auth: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Body (JSON):
 * {
 *   "documentNumber": "12345678",
 *   "documentDate":  "09/09/2026",
 *   "paymentDate":   "09/09/2026",
 *   "lines": [
 *     { "hdIdNumber": "800251590", "amount": 8246.07, "customerName": "LAURA LETIEC", "invoiceDate": "09/01/2026" },
 *     { "hdIdNumber": "800244079", "amount": -9148.83, "isChargeback": true }
 *   ]
 * }
 *
 * Matches each line to a deal by hdReference, marks matched positive deals FUNDED
 * (dealer never sees the dollar figures), and flags chargebacks. Idempotent by
 * documentNumber.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer || !secretMatches(bearer, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RETIRED. The portal now parses Home Depot remittances in-house — the Gmail
  // auto-pull (sweepHdRemittances) and the manual PDF upload, BOTH gated by the
  // grand-total integrity check so a mis-parse can never be stored. This endpoint
  // accepted pre-parsed lines from the old Google Apps Script and ingested them
  // WITHOUT that guard, so a shuffled/incomplete script parse could land first and
  // (being idempotent by document number) block the portal's correct parse. It is
  // disabled: nothing is ingested. Turn off the Apps Script's trigger; use
  // Admin → HD Remittances for uploads and re-processing.
  return NextResponse.json({
    ok: false,
    disabled: true,
    error: 'This ingest endpoint is retired. Home Depot remittances are now parsed in-house by the portal (Admin → HD Remittances). No data was ingested. Please disable the Google Apps Script.',
  }, { status: 410 });
}

export async function POST(req: NextRequest) {
  return handle(req);
}
