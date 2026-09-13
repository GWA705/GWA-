'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { setSetting, JOURNAL_SETTING_KEYS, type JournalWriteMode } from '@/lib/settings';
import {
  importJournalYear,
  previewJournalYear,
  type ImportYearResult,
  type JournalPreview,
} from '@/lib/reporting/journalImport';

/**
 * Switch where the "Write to Journal" feature writes deals: the safe TEST
 * journal or the real LIVE journal. Admin-only — this changes where real
 * customer data lands. Reporting reads are unaffected (always the live journal).
 */
export async function setJournalWriteModeAction(mode: JournalWriteMode): Promise<void> {
  const session = await requireRole('ADMIN');
  const value: JournalWriteMode = mode === 'live' ? 'live' : 'test';
  await setSetting(JOURNAL_SETTING_KEYS.writeMode, value);
  await audit({
    actorId: session.userId,
    action: 'SETTING_UPDATE',
    entityType: 'AppSetting',
    entityId: JOURNAL_SETTING_KEYS.writeMode,
    detail: `journal write mode = ${value}`,
  });
  revalidatePath('/staff/reports/connection');
}

/**
 * Upload (or re-sync) one closed journal year from Google Sheets into the
 * Postgres archive, so office customer search reads it straight from the DB.
 * Admin-only. Replaces the year's rows atomically (delete + bulk insert).
 */
export async function importJournalYearAction(year: number, force = false): Promise<ImportYearResult> {
  const session = await requireRole('ADMIN');
  const yr = Number(year);
  if (!Number.isInteger(yr) || yr < 2000 || yr > 2100) {
    return { year: yr, ok: false, rows: 0, matched: 0, unmatched: 0, totalIssues: 0, error: 'Invalid year.' };
  }
  const res = await importJournalYear(yr, { force: Boolean(force) });
  await audit({
    actorId: session.userId,
    action: 'JOURNAL_ARCHIVE_IMPORT',
    entityType: 'JournalRecord',
    entityId: String(yr),
    detail: res.ok
      ? `archived ${yr}: ${res.rows} rows (${res.matched} matched, ${res.totalIssues} issues)${force ? ' [forced]' : ''}`
      : `archive ${yr} ${res.blocked ? 'blocked' : 'failed'}: ${res.error ?? 'unknown error'}`,
  });
  revalidatePath('/staff/reports/connection');
  return res;
}

/**
 * Dry read of a closed journal year — verify the parse looks correct BEFORE
 * uploading. No database writes. Admin-only.
 */
export async function previewJournalYearAction(year: number): Promise<JournalPreview> {
  await requireRole('ADMIN');
  const yr = Number(year);
  return previewJournalYear(yr);
}

/**
 * Import a Home Depot VOC (Voice of the Customer) export (.xlsx). Admin-only.
 * Upserts by Lead #, so re-uploading a fuller export just fills in the gaps.
 */
export async function importVocAction(
  _prev: { ok?: boolean; error?: string; message?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const session = await requireRole('ADMIN');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a VOC .xlsx file to upload.' };
  if (file.size > 15 * 1024 * 1024) return { error: 'That file is too large (max 15 MB).' };

  const { importVocBuffer } = await import('@/lib/reporting/voc');
  const buf = Buffer.from(await file.arrayBuffer());
  const res = await importVocBuffer(buf, session.userId);
  if (res.error) return { error: res.error };

  await audit({ actorId: session.userId, action: 'SETTING_UPDATE', entityType: 'VocEntry', detail: `Imported ${res.imported} VOC rows` });
  revalidatePath('/staff/reports/voc');
  revalidatePath('/dealer/reports/voc');
  return { ok: true, message: `Imported ${res.imported} VOC ${res.imported === 1 ? 'review' : 'reviews'}.` };
}

/**
 * Check whether a VOC has been completed for one or more HD Lead #s. Accepts a
 * pasted list (textarea) and/or an uploaded list (.xlsx / .csv / .txt). Staff
 * with reports access only.
 */
export async function vocLookupAction(
  _prev: { result?: unknown; error?: string },
  formData: FormData,
): Promise<{ result?: import('@/lib/reporting/voc').VocLookupResult; error?: string }> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const { canViewReportsArea } = await import('@/lib/reporting/access');
  if (!(await canViewReportsArea(user))) return { error: 'Not authorized.' };

  const { extractRefs } = await import('@/lib/reporting/vocMatch');
  const { extractRefsFromFile, lookupVocs } = await import('@/lib/reporting/voc');

  const pasted = String(formData.get('refs') ?? '');
  let refs = extractRefs(pasted);

  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) return { error: 'That file is too large (max 15 MB).' };
    const buf = Buffer.from(await file.arrayBuffer());
    refs = refs.concat(await extractRefsFromFile(buf, file.name));
  }

  if (refs.length === 0) return { error: 'Paste some numbers or upload a list first.' };
  if (refs.length > 5000) return { error: 'Too many numbers at once (max 5000).' };

  const result = await lookupVocs(refs);
  return { result };
}
