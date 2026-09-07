/**
 * Parser for the AAMVA PDF417 barcode on the back of North American driver's
 * licences / ID cards. The barcode encodes the holder's data as newline-separated
 * 3-letter element codes (DCS = last name, DAC = first name, …). Reading this is
 * exact structured data — far more accurate than OCR of the printed front — so
 * it's the primary source for the licence-scan autofill.
 *
 * Pure + isomorphic (no DOM / node APIs) so it can run in the browser after a
 * client-side barcode decode, and be unit-checked in isolation.
 */

export interface LicenseFields {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string; // yyyy-mm-dd
  expiry: string; // yyyy-mm-dd
  idNumber: string;
  province: string; // 2-letter jurisdiction code (ON, BC, …) when Canadian
  address: string; // street
  city: string;
  postal: string; // normalized "A1A 1A1" when Canadian
}

const EMPTY: LicenseFields = {
  firstName: '', middleName: '', lastName: '', dob: '', expiry: '',
  idNumber: '', province: '', address: '', city: '', postal: '',
};

/** An 8-digit AAMVA date is MMDDCCYY (US) or CCYYMMDD (Canada). Detect by which
 *  interpretation yields a valid, plausible date. */
function parseAamvaDate(raw: string): string {
  const s = (raw || '').trim();
  const m = s.match(/^(\d{8})$/);
  if (!m) return '';
  const d = m[1];
  const valid = (y: number, mo: number, day: number) =>
    y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && day >= 1 && day <= 31;

  // CCYYMMDD (Canadian) — try first when the leading 4 digits read as a year.
  const y1 = +d.slice(0, 4), mo1 = +d.slice(4, 6), day1 = +d.slice(6, 8);
  // MMDDCCYY (US).
  const mo2 = +d.slice(0, 2), day2 = +d.slice(2, 4), y2 = +d.slice(4, 8);

  if (y1 >= 1900 && y1 <= 2100 && valid(y1, mo1, day1)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  if (valid(y2, mo2, day2)) {
    return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
  }
  return '';
}

/** Normalize a Canadian postal code to "A1A 1A1"; leave anything else as-is. */
function normalizePostal(raw: string): string {
  const s = (raw || '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/);
  return m ? `${m[1]} ${m[2]}` : (raw || '').trim();
}

function titleCase(s: string): string {
  const v = (s || '').trim();
  if (!v) return '';
  // Leave values that are already mixed-case alone; only fix ALL-CAPS (typical on
  // the barcode) so "SMITH" → "Smith", "MCLEOD" stays reasonable.
  if (v !== v.toUpperCase()) return v;
  return v.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/**
 * Parse a decoded AAMVA barcode payload into licence fields. Returns null when
 * the payload doesn't look like an AAMVA record (so the caller can fall back).
 */
export function parseAamva(payload: string): LicenseFields | null {
  if (!payload || !/ANSI\s|DCS|DAQ/.test(payload)) return null;
  // Elements are 3 uppercase letters + value, terminated by CR/LF. Normalize
  // separators, then scan.
  const text = payload.replace(/\r/g, '\n');
  const els = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z]{3})(.*)$/);
    if (m) {
      const code = m[1];
      const val = m[2].trim();
      if (!els.has(code) && val) els.set(code, val);
    }
  }
  const g = (code: string) => els.get(code) || '';

  // Names: DCS = family/last, DAC/DCT = first, DAD = middle. Some jurisdictions
  // pack "LAST,FIRST,MIDDLE" into DCT — handle that too.
  let lastName = g('DCS');
  let firstName = g('DAC') || g('DCT');
  let middleName = g('DAD');
  if (!lastName && !firstName && g('DCT').includes(',')) {
    const [l, f, mid] = g('DCT').split(',');
    lastName = l || ''; firstName = f || ''; middleName = mid || '';
  }
  // "NONE" is the AAMVA sentinel for "no middle name".
  if (/^none$/i.test(middleName)) middleName = '';

  const fields: LicenseFields = {
    ...EMPTY,
    firstName: titleCase(firstName),
    middleName: titleCase(middleName),
    lastName: titleCase(lastName),
    dob: parseAamvaDate(g('DBB')),
    expiry: parseAamvaDate(g('DBA')),
    idNumber: g('DAQ'),
    province: (g('DAJ') || '').toUpperCase().slice(0, 2),
    address: titleCase(g('DAG')),
    city: titleCase(g('DAI')),
    postal: normalizePostal(g('DAK')),
  };

  // Require at least a name to consider it a successful read.
  if (!fields.firstName && !fields.lastName) return null;
  return fields;
}
