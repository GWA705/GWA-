import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ingestRemittance, type RemittanceLineInput } from '@/lib/hdRemittance';

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

  let body: {
    documentNumber?: string; documentDate?: string; paymentDate?: string;
    lines?: RemittanceLineInput[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: 'lines[] is required' }, { status: 400 });
  }

  const result = await ingestRemittance({
    documentNumber: body.documentNumber,
    documentDate: body.documentDate,
    paymentDate: body.paymentDate,
    source: 'WEBHOOK',
    lines: body.lines.slice(0, 2000),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(req: NextRequest) {
  return handle(req);
}
