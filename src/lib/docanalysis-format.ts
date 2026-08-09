// Shared shape + display helper for the automated document pre-check. Kept free
// of heavy imports (no unpdf) so the reviewer UI can import it without pulling in
// the PDF engine.

export const DOC_ANALYSIS_VERSION = 1;

export interface DocAnalysis {
  version: number;
  analyzedAt: string;
  kind: 'pdf' | 'image' | 'other';
  pages: number;
  hasTextLayer: boolean;
  scanned: boolean; // pages present but little/no readable text
  dates: string[]; // date strings found (deduped)
  datePages: number[]; // 1-based pages a date was found on
  lowTextPages: number[]; // 1-based pages with almost no text (possible blank)
  eSignatures: number; // count of /FT /Sig form fields
  digitallySigned: boolean; // a real cryptographic signature is present
  ocr?: { used: boolean; dates?: string[]; note?: string };
  note?: string;
}

export type ChipTone = 'good' | 'warn' | 'neutral';
export interface AnalysisChip {
  label: string;
  tone: ChipTone;
}

function asAnalysis(raw: unknown): Partial<DocAnalysis> | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as Partial<DocAnalysis>;
}

/** Whether an on-demand "Read this scan" (OCR) makes sense for this document. */
export function ocrEligible(raw: unknown): boolean {
  const a = asAnalysis(raw);
  if (!a) return false;
  return !!a.scanned && !a.ocr?.used;
}

/**
 * Turn a stored analysis blob into a short list of reviewer-facing chips. Purely
 * assistive — the reviewer still confirms every document.
 */
export function summarizeAnalysis(raw: unknown): AnalysisChip[] {
  const a = asAnalysis(raw);
  if (!a) return [];
  const chips: AnalysisChip[] = [];

  if (typeof a.pages === 'number' && a.pages > 0) {
    chips.push({ label: `${a.pages} page${a.pages === 1 ? '' : 's'}`, tone: 'neutral' });
  }

  // Dates — prefer text-layer dates, fall back to OCR dates.
  const dates = (a.dates && a.dates.length ? a.dates : a.ocr?.dates) ?? [];
  if (dates.length > 0) {
    const shown = dates.slice(0, 2).join(', ');
    chips.push({ label: `📅 ${shown}${dates.length > 2 ? ` +${dates.length - 2}` : ''}`, tone: 'good' });
  } else if (a.hasTextLayer || a.ocr?.used) {
    chips.push({ label: 'No date found', tone: 'warn' });
  }

  // Signatures — only a positive signal is reliable (e-signed docs).
  if (a.digitallySigned || (a.eSignatures ?? 0) > 0) {
    chips.push({ label: '✓ e-signed', tone: 'good' });
  }

  // Scan / blank flags.
  if (a.scanned && !a.ocr?.used) {
    chips.push({ label: 'Scan — text not read', tone: 'warn' });
  } else if (a.scanned && a.ocr?.used) {
    chips.push({ label: 'Scan — read by OCR', tone: 'neutral' });
  }
  if (a.hasTextLayer && a.lowTextPages && a.lowTextPages.length > 0) {
    const p = a.lowTextPages.slice(0, 3).join(', ');
    chips.push({ label: `Possible blank page: ${p}`, tone: 'warn' });
  }

  return chips;
}
