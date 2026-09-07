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
