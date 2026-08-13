'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { audit } from '@/lib/audit';
import { setSetting, SEARCH_SETTING_KEYS } from '@/lib/settings';

/** Turn the global customer-search feature on or off (privacy-sensitive). */
export async function setGlobalSearchAction(enabled: boolean): Promise<void> {
  const session = await requireAdminSection('security');
  await setSetting(SEARCH_SETTING_KEYS.globalEnabled, enabled ? 'true' : '');
  await audit({
    actorId: session.userId,
    action: 'SETTING_UPDATE',
    entityType: 'AppSetting',
    entityId: SEARCH_SETTING_KEYS.globalEnabled,
    detail: `global customer search = ${enabled ? 'on' : 'off'}`,
  });
  revalidatePath('/admin/security');
}
