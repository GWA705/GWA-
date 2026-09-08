import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { extractTextForScan } from '@/lib/ocr';
import { extractExpiryDate, extractAccountNumber } from '@/lib/docanalysis';
import { DOC_MAX_BYTES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Read an uploaded business document (WSIB/WCB clearance letter, etc.) and return
 * its likely expiry/renewal date plus any account number, so the dealer's upload
 * form auto-fills. On-prem only: reads the PDF text layer, falling back to
 * tesseract OCR for image scans (same engine as the reviewer Auto-check) — the
 * file is read in memory and NOTHING is stored here. Degrades gracefully: if it
 * can't read a date it returns { ok:true, expiry:null } and the dealer types it.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const rl = await rateLimit(`scan-expiry:${session.userId}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });

  let bytes: Buffer;
  let mime: string;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return NextResponse.json({ ok: false, reason: 'no_file' }, { status: 400 });
    if (file.size > DOC_MAX_BYTES) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 });
    bytes = Buffer.from(await file.arrayBuffer());
    mime = file.type || 'application/octet-stream';
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  try {
    const text = await extractTextForScan(bytes, mime, 5);
    if (!text || text.replace(/\s+/g, '').length < 8) {
      return NextResponse.json({ ok: true, expiry: null, dates: [], accountNumber: null, reason: 'no_text' });
    }
    const { iso, all } = extractExpiryDate(text);
    const accountNumber = extractAccountNumber(text);
    return NextResponse.json({ ok: true, expiry: iso, dates: all.slice(0, 12), accountNumber });
  } catch (e) {
    console.error('[scan-expiry] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true, expiry: null, dates: [], accountNumber: null, reason: 'unreadable' });
  }
}
