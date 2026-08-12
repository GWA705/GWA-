'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { setSetting, JOURNAL_SETTING_KEYS, type JournalWriteMode } from '@/lib/settings';

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
