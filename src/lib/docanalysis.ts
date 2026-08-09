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
