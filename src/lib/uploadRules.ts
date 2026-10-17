import 'server-only';
import { PDFDocument } from 'pdf-lib';
import type { DocumentType } from '@prisma/client';
import { getSetting, setSetting } from './settings';

// Page-count "laws" for dealer funding-package uploads, to keep the right
// paperwork in the right box. Each box can expect a page count and either BLOCK
// (refuse the upload) or WARN (flag it, still accept). Admin-editable so a form
// change or a scanner quirk can be loosened without a deploy. Unreadable files
// fail OPEN (never blocked) — a rule must never stop a file we couldn't inspect.

export type UploadRuleMode = 'block' | 'warn';
export interface UploadRule {
  expectedPages: number;
  mode: UploadRuleMode;
}

export const UPLOAD_RULES_KEY = 'upload.docRules';

// Defaults (admin can change). The 1-page HD waiver is the safest to block; the
// HD agreement starts as a warning (4 pages can shift with a form/scanner change)
// and the FinanceIt contract warns (length legitimately varies).
export const DEFAULT_UPLOAD_RULES: Partial<Record<DocumentType, UploadRule>> = {
  HD_WAIVER: { expectedPages: 1, mode: 'block' },
  SIGNED_HD_DOCUMENT: { expectedPages: 4, mode: 'warn' },
  SIGNED_CONTRACT: { expectedPages: 25, mode: 'warn' },
};

// Which funding boxes a page-count rule can apply to (for the admin editor).
export const RULEABLE_DOC_TYPES: DocumentType[] = ['SIGNED_CONTRACT', 'SIGNED_HD_DOCUMENT', 'HD_WAIVER', 'VOID_CHEQUE_OR_PAP'];

function coerce(parsed: unknown): Partial<Record<DocumentType, UploadRule>> {
  const out: Partial<Record<DocumentType, UploadRule>> = {};
  if (!parsed || typeof parsed !== 'object') return out;
  for (const [k, v] of Object.entries(parsed as Record<string, { expectedPages?: unknown; mode?: unknown }>)) {
    const pages = Math.floor(Number(v?.expectedPages));
    if (!Number.isFinite(pages) || pages <= 0) continue; // 0 / blank = rule off for this box
    out[k as DocumentType] = { expectedPages: pages, mode: v?.mode === 'block' ? 'block' : 'warn' };
  }
  return out;
}

/** The effective rules: the admin override when set, otherwise the defaults. */
export async function getUploadRules(): Promise<Partial<Record<DocumentType, UploadRule>>> {
  const raw = await getSetting(UPLOAD_RULES_KEY);
  if (!raw) return DEFAULT_UPLOAD_RULES;
  try {
    return coerce(JSON.parse(raw));
  } catch {
    return DEFAULT_UPLOAD_RULES;
  }
}

/** Save the admin override (stores a JSON object, '{}' = all rules off). */
export async function setUploadRules(rules: Partial<Record<DocumentType, UploadRule>>): Promise<void> {
  const clean = coerce(rules);
  await setSetting(UPLOAD_RULES_KEY, JSON.stringify(clean));
}

/**
 * Page count of an uploaded file, or null when it can't be determined (fail
 * open). Images become a single-page PDF, so they count as 1.
 */
export async function pageCountOf(file: File): Promise<number | null> {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return 1;
  const isPdf = type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return null;
  }
}
