import { getDocumentProxy, extractText } from 'unpdf';
import { DOC_ANALYSIS_VERSION, type DocAnalysis } from './docanalysis-format';

/**
 * Tier-1 document pre-check (assistive, on-prem — no data leaves the portal).
 * Reads a PDF's text layer to surface page count, dates, low-text/blank pages,
 * and scan-vs-text; scans the raw bytes for e-signature signals. Never throws —
 * on any failure it returns a safe "couldn't read" result so uploads are never
 * blocked. OCR of image-only scans is a later tier.
 */

const DATE_PATTERNS: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // 2026-08-09
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, // 08/09/2026, 9-8-26
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/gi, // August 9, 2026
];

export function findDates(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const re of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const raw = m[0].trim();
      const key = raw.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(raw);
      }
    }
  }
  return out;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse one of the loose date strings findDates() returns into an ISO
 * YYYY-MM-DD string, or null if it can't be read. Numeric D/M vs M/D is
 * ambiguous; we assume the North-American M/D/Y order (matching the ID scanner).
 */
export function parseLooseDate(raw: string): string | null {
  const s = raw.trim();
  // ISO: 2026-08-09
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Month name: August 9, 2026 / Aug. 9 2026
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return null;
  }
  // Numeric: 08/09/2026, 8-9-26 (assume M/D/Y)
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, mo, d, yr] = m;
    let year = Number(yr);
    if (yr.length === 2) year += year < 70 ? 2000 : 1900;
    const moN = Number(mo);
    const dN = Number(d);
    if (moN < 1 || moN > 12 || dN < 1 || dN > 31) return null;
    return `${year}-${String(moN).padStart(2, '0')}-${String(dN).padStart(2, '0')}`;
  }
  return null;
}

const EXPIRY_KEYWORDS = /(expir|valid\s+(?:until|to|through)|valid\s+up\s+to|renewal|renew\s+by|good\s+(?:until|through)|effective\s+(?:until|to)|coverage\s+(?:until|to|end)|end\s+date|due\s+date|next\s+review|certificate\s+valid)/i;

/**
 * Pull the most likely expiry/renewal date out of a document's text. Prefers a
 * date sitting next to an expiry-style keyword ("valid until", "expires",
 * "renewal", …); otherwise falls back to the latest future date in the file.
 * Returns the ISO date plus every date found (so the dealer can pick another).
 * Best-effort only — the dealer always confirms it.
 */
export function extractExpiryDate(text: string, now: Date = new Date()): { iso: string | null; all: string[] } {
  const flat = text.replace(/\s+/g, ' ');
  const all = findDates(flat);
  const isoAll = all.map(parseLooseDate).filter((d): d is string => !!d);

  // 1) A date within ~40 chars after an expiry keyword.
  for (const km of flat.matchAll(new RegExp(EXPIRY_KEYWORDS.source, 'gi'))) {
    const window = flat.slice(km.index ?? 0, (km.index ?? 0) + 60);
    for (const d of findDates(window)) {
      const iso = parseLooseDate(d);
      if (iso) return { iso, all: isoAll };
    }
  }

  // 2) Fallback: the latest future date (a clearance letter's valid-through is
  // usually the furthest-out date on the page).
  const todayIso = now.toISOString().slice(0, 10);
  const future = isoAll.filter((d) => d >= todayIso).sort();
  if (future.length) return { iso: future[future.length - 1], all: isoAll };

  // 3) Last resort: the latest date of any kind.
  const sorted = [...isoAll].sort();
  return { iso: sorted.length ? sorted[sorted.length - 1] : null, all: isoAll };
}

/** Best-effort account/policy number near a WSIB/WCB "account #" label. */
export function extractAccountNumber(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ');
  const m = flat.match(/(?:account|policy|firm|employer)\s*(?:number|no\.?|#)\s*[:#]?\s*([0-9][0-9\s-]{4,15}[0-9])/i);
  if (!m) return null;
  return m[1].replace(/[\s-]/g, '').slice(0, 20);
}

function signatureSignals(bytes: Buffer): { eSignatures: number; digitallySigned: boolean } {
  // Look only at the tail where signature dicts / xref live, to keep it cheap.
  const tail = bytes.subarray(Math.max(0, bytes.length - 2_000_000)).toString('latin1');
  const eSignatures = (tail.match(/\/FT\s*\/Sig/g) || []).length;
  const digitallySigned = /\/ByteRange\s*\[/.test(tail);
  return { eSignatures, digitallySigned };
}

function base(): Pick<DocAnalysis, 'version' | 'analyzedAt'> {
  return { version: DOC_ANALYSIS_VERSION, analyzedAt: new Date().toISOString() };
}

export async function analyzeDocument(bytes: Buffer, mimeType: string): Promise<DocAnalysis> {
  if (mimeType !== 'application/pdf') {
    const isImage = mimeType.startsWith('image/');
    return {
      ...base(),
      kind: isImage ? 'image' : 'other',
      pages: isImage ? 1 : 0,
      hasTextLayer: false,
      scanned: isImage,
      dates: [],
      datePages: [],
      lowTextPages: [],
      eSignatures: 0,
      digitallySigned: false,
      note: isImage ? 'Image upload — text not read (OCR pending).' : undefined,
    };
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages: string[] = Array.isArray(text) ? text.map((t) => t ?? '') : [String(text ?? '')];

    const dates: string[] = [];
    const datePages: number[] = [];
    const lowTextPages: number[] = [];
    let totalChars = 0;

    pages.forEach((raw, idx) => {
      const clean = raw.replace(/\s+/g, ' ').trim();
      totalChars += clean.length;
      if (clean.length < 8) lowTextPages.push(idx + 1);
      const found = findDates(clean);
      if (found.length > 0) {
        datePages.push(idx + 1);
        for (const d of found) if (!dates.includes(d)) dates.push(d);
      }
    });

    const avgChars = totalPages > 0 ? totalChars / totalPages : 0;
    const hasTextLayer = avgChars >= 20;
    const sig = signatureSignals(bytes);

    return {
      ...base(),
      kind: 'pdf',
      pages: totalPages,
      hasTextLayer,
      scanned: !hasTextLayer,
      dates: dates.slice(0, 12),
      datePages,
      lowTextPages,
      eSignatures: sig.eSignatures,
      digitallySigned: sig.digitallySigned,
    };
  } catch {
    return {
      ...base(),
      kind: 'pdf',
      pages: 0,
      hasTextLayer: false,
      scanned: false,
      dates: [],
      datePages: [],
      lowTextPages: [],
      eSignatures: 0,
      digitallySigned: false,
      note: 'Could not read this PDF automatically.',
    };
  }
}
