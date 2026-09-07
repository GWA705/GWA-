import { NextResponse, type NextRequest } from 'next/server';
import { TextractClient, AnalyzeDocumentCommand, type Block } from '@aws-sdk/client-textract';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import type { BorrowerAutofill } from '@/lib/autofill';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Read an uploaded, filled credit-application (the Financeit loan application) and
 * return the fields, so the dealer's upload auto-fills the portal form. Runs AWS
 * Textract forms OCR (key/value pairs) on the image/single-page PDF in memory and
 * stores NOTHING. Degrades gracefully: if Textract isn't configured/permitted it
 * returns { ok:false, reason:'not_enabled' } and the UI tells the dealer to type.
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
  return PROVINCE_BY_NAME[s.toLowerCase()] || s;
}
function toIso(raw: string): string {
  const s = (raw || '').trim();
  const us = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

// Label fragment → field. Order matters: specific rules before the generic
// address/city/province/postal ones, so "Employer Address" isn't taken as the
// home address. Generic rows take the FIRST (topmost) match = the Housing block.
const RULES: [RegExp, keyof BorrowerAutofill][] = [
  [/first name/, 'firstName'],
  [/middle name/, 'middleName'],
  [/last name/, 'lastName'],
  [/birthdate|date of birth/, 'dob'],
  [/e-?mail/, 'email'],
  [/mobile phone/, 'phone'],
  [/home phone/, 'homePhone'],
  [/marital status/, 'maritalStatus'],
  [/monthly housing/, 'monthlyHousingCost'],
  [/years at this address/, 'yearsAtAddress'],
  [/housing status/, 'housingStatus'],
  [/card type/, 'idType'],
  [/photo id number|id number/, 'idNumber'],
  [/photo id province/, 'idProvince'],
  [/expiry|expiration/, 'idExpiry'],
  [/business name/, 'businessName'],
  [/position title/, 'positionTitle'],
  [/employer.{0,3}s? phone/, 'employerPhone'],
  [/employer address/, 'employerAddress'],
  [/gross monthly income/, 'grossMonthlyIncome'],
  [/time at job/, 'timeAtJob'],
  [/^address/, 'address'],
  [/^city/, 'city'],
  [/^province/, 'province'],
  [/^postal code/, 'postal'],
];

function blockText(block: Block, byId: Map<string, Block>): string {
  const words: string[] = [];
  for (const rel of block.Relationships ?? []) {
    if (rel.Type !== 'CHILD') continue;
    for (const id of rel.Ids ?? []) {
      const child = byId.get(id);
      if (child?.BlockType === 'WORD' && child.Text) words.push(child.Text);
      else if (child?.BlockType === 'SELECTION_ELEMENT' && child.SelectionStatus === 'SELECTED') words.push('X');
    }
  }
  return words.join(' ').trim();
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const rl = await rateLimit(`scan-doc:${session.userId}`, 15, 60);
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
    const client = new TextractClient({ region: process.env.S3_REGION || 'ca-central-1' });
    const out = await client.send(new AnalyzeDocumentCommand({ Document: { Bytes: bytes }, FeatureTypes: ['FORMS'] }));
    const blocks = out.Blocks ?? [];
    const byId = new Map<string, Block>(blocks.filter((b) => b.Id).map((b) => [b.Id!, b]));

    // Collect KEY blocks with their value text + vertical position (for "first").
    const pairs: { label: string; value: string; top: number }[] = [];
    for (const b of blocks) {
      if (b.BlockType !== 'KEY_VALUE_SET' || !b.EntityTypes?.includes('KEY')) continue;
      const label = blockText(b, byId).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!label) continue;
      const valueId = b.Relationships?.find((r) => r.Type === 'VALUE')?.Ids?.[0];
      const valueBlock = valueId ? byId.get(valueId) : undefined;
      const value = valueBlock ? blockText(valueBlock, byId) : '';
      pairs.push({ label, value, top: b.Geometry?.BoundingBox?.Top ?? 0 });
    }
    pairs.sort((a, b) => a.top - b.top); // top-to-bottom reading order

    const fields: BorrowerAutofill = {};
    for (const p of pairs) {
      if (!p.value) continue;
      for (const [re, key] of RULES) {
        if (!re.test(p.label)) continue;
        if (fields[key]) break; // keep the first (topmost) match
        let v = p.value;
        if (key === 'dob' || key === 'idExpiry') v = toIso(v);
        else if (key === 'province' || key === 'idProvince') v = toProvinceCode(v);
        if (v) fields[key] = v;
        break;
      }
    }

    if (!fields.firstName && !fields.lastName) return NextResponse.json({ ok: false, reason: 'no_fields' });
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    console.error('[scan-doc] Textract AnalyzeDocument failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, reason: 'not_enabled' });
  }
}
