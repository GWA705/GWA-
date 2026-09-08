import { NextResponse, type NextRequest } from 'next/server';
import { TextractClient, AnalyzeDocumentCommand, type Block } from '@aws-sdk/client-textract';
import { getSession } from '@/lib/session';
import { rateLimit } from '@/lib/ratelimit';
import { parseFlexibleDate } from '@/lib/dateparse';
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
// A Textract value can pick up printed helper text next to the box (e.g. the
// email line's "An email address is required…"). Trim each value to just the
// data for that field.
function cleanValue(key: keyof BorrowerAutofill, raw: string): string {
  const v = (raw || '').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  if (key === 'email') {
    const m = v.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i);
    return m ? m[0] : '';
  }
  if (key === 'phone' || key === 'homePhone' || key === 'employerPhone') {
    const d = v.replace(/\D/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  }
  if (key === 'postal') {
    const m = v.toUpperCase().replace(/\s+/g, '').match(/[A-Z]\d[A-Z]\d[A-Z]\d/);
    return m ? `${m[0].slice(0, 3)} ${m[0].slice(3)}` : v.slice(0, 7);
  }
  if (key === 'grossMonthlyIncome' || key === 'monthlyHousingCost') {
    const n = v.replace(/[^0-9.]/g, '');
    return n;
  }
  if (key === 'idNumber') return v.replace(/[^0-9A-Za-z\- ]/g, '').slice(0, 25).trim();
  // Names/addresses/etc.: strip an obvious trailing helper sentence and cap length.
  return v.split(/\s{2,}|(?: [–—-] )/)[0].slice(0, 60).trim();
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

    // Collect KEY blocks with their value text, vertical position (for "first"),
    // and the OCR confidence of the value (to flag shaky reads).
    const pairs: { label: string; value: string; top: number; conf: number }[] = [];
    for (const b of blocks) {
      if (b.BlockType !== 'KEY_VALUE_SET' || !b.EntityTypes?.includes('KEY')) continue;
      const label = blockText(b, byId).toLowerCase().replace(/\s+/g, ' ').trim();
      if (!label) continue;
      const valueId = b.Relationships?.find((r) => r.Type === 'VALUE')?.Ids?.[0];
      const valueBlock = valueId ? byId.get(valueId) : undefined;
      const value = valueBlock ? blockText(valueBlock, byId) : '';
      pairs.push({ label, value, top: b.Geometry?.BoundingBox?.Top ?? 0, conf: valueBlock?.Confidence ?? 100 });
    }
    pairs.sort((a, b) => a.top - b.top); // top-to-bottom reading order

    // Textract confidence below this (0–100) is flagged for the dealer to verify.
    const CONF_MIN = 88;

    const fields: BorrowerAutofill = {};
    // Fields the scan is unsure about — a guessed date order, or a low-confidence
    // OCR read — so the UI can tell the dealer exactly what to double-check.
    const uncertain = new Set<string>();
    for (const p of pairs) {
      if (!p.value) continue;
      for (const [re, key] of RULES) {
        if (!re.test(p.label)) continue;
        if (fields[key]) break; // keep the first (topmost) match
        let v: string;
        let ambiguous = false;
        if (key === 'dob' || key === 'idExpiry') {
          const parsed = parseFlexibleDate(p.value);
          v = parsed.iso ?? '';
          ambiguous = parsed.ambiguous;
        } else if (key === 'province' || key === 'idProvince') {
          v = toProvinceCode(cleanValue(key, p.value));
        } else {
          v = cleanValue(key, p.value);
        }
        if (v) {
          fields[key] = v;
          if (ambiguous || p.conf < CONF_MIN) uncertain.add(key);
        }
        break;
      }
    }

    if (!fields.firstName && !fields.lastName) return NextResponse.json({ ok: false, reason: 'no_fields' });
    return NextResponse.json({ ok: true, fields, uncertain: Array.from(uncertain) });
  } catch (e) {
    console.error('[scan-doc] Textract AnalyzeDocument failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, reason: 'not_enabled' });
  }
}
