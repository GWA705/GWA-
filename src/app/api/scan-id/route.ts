import { NextResponse, type NextRequest } from 'next/server';
import { TextractClient, AnalyzeIDCommand } from '@aws-sdk/client-textract';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import type { LicenseFields } from '@/lib/aamva';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Driver's-licence photo reader. Runs AWS Textract AnalyzeID on a photo of the
 * FRONT of the licence and returns the fields. The image is processed in memory
 * and NEVER stored — this route persists nothing. Degrades gracefully: if
 * Textract isn't configured/permitted, it returns { ok:false, reason:'not_enabled' }
 * so the UI tells the dealer to enter details manually.
 *
 * REGION NOTE: AnalyzeID is NOT offered in every region — in particular it may not
 * be available in ca-central-1 (where the rest of our AWS lives). Set
 * TEXTRACT_ID_REGION to an AnalyzeID-supported region (e.g. us-east-1) to turn the
 * licence photo scan on. Doing so means the licence image is processed in that
 * region — outside Canada if you pick a US region — though it is never stored.
 * Default stays ca-central-1 to keep data in Canada; if AnalyzeID isn't offered
 * there the scan simply reports "not switched on" until TEXTRACT_ID_REGION is set.
 */

const PROVINCE_BY_NAME: Record<string, string> = {
  alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
  'newfoundland and labrador': 'NL', 'nova scotia': 'NS', 'northwest territories': 'NT',
  nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC',
  saskatchewan: 'SK', yukon: 'YT',
};

function toProvinceCode(raw: string): string {
  const s = (raw || '').trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return PROVINCE_BY_NAME[s.toLowerCase()] || '';
}

function toIsoDate(field: { ValueDetection?: { Text?: string; NormalizedValue?: { Value?: string } } } | undefined): string {
  const norm = field?.ValueDetection?.NormalizedValue?.Value; // ISO 8601 when Textract normalized it
  if (norm) return norm.slice(0, 10);
  const txt = (field?.ValueDetection?.Text || '').trim();
  const m = txt.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // MM/DD/YYYY
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const iso = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rl = await rateLimit(`scan-id:${session.userId}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });

  let bytes: Uint8Array;
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!(file instanceof Blob)) return NextResponse.json({ ok: false, reason: 'no_image' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 });
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  try {
    const client = new TextractClient({ region: process.env.TEXTRACT_ID_REGION || process.env.S3_REGION || 'ca-central-1' });
    const out = await client.send(new AnalyzeIDCommand({ DocumentPages: [{ Bytes: bytes }] }));
    const doc = out.IdentityDocuments?.[0];
    if (!doc) return NextResponse.json({ ok: false, reason: 'no_fields' });

    const by: Record<string, { ValueDetection?: { Text?: string; NormalizedValue?: { Value?: string } } }> = {};
    for (const f of doc.IdentityDocumentFields ?? []) {
      const type = f.Type?.Text;
      if (type) by[type] = f;
    }
    const text = (k: string) => (by[k]?.ValueDetection?.Text || '').trim();

    const fields: LicenseFields = {
      firstName: text('FIRST_NAME'),
      middleName: text('MIDDLE_NAME'),
      lastName: text('LAST_NAME'),
      dob: toIsoDate(by['DATE_OF_BIRTH']),
      expiry: toIsoDate(by['EXPIRATION_DATE']),
      idNumber: text('DOCUMENT_NUMBER'),
      province: toProvinceCode(text('STATE_IN_ADDRESS') || text('STATE_NAME')),
      address: text('ADDRESS'),
      city: text('CITY_IN_ADDRESS'),
      postal: text('ZIP_CODE_IN_ADDRESS'),
    };

    if (!fields.firstName && !fields.lastName) return NextResponse.json({ ok: false, reason: 'no_fields' });
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    // Textract not enabled / no permission / region unsupported — handled by the UI.
    console.error('[scan-id] Textract AnalyzeID failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, reason: 'not_enabled' });
  }
}
