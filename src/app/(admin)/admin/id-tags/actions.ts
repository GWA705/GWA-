'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { setIdTagStatus, isIdTagStatus, setIdTagEnabledOffices } from '@/lib/idTag';
import { setSetting, ID_TAG_SETTING_KEYS } from '@/lib/settings';

/** Who can see/use the HD ID Tag feature. Empty list = default (GWA office only,
 *  while it's being built); a non-empty list = exactly those offices. */
export async function saveIdTagOfficesAction(formData: FormData): Promise<void> {
  await requireAdminSection('id-tags');
  const ids = formData.getAll('offices').map((v) => String(v)).filter(Boolean);
  await setIdTagEnabledOffices(ids);
  revalidatePath('/admin/id-tags');
  revalidatePath('/dealer', 'layout');
}

/** Move one ID-tag request to a new status. */
export async function updateIdTagStatusAction(formData: FormData): Promise<void> {
  await requireAdminSection('id-tags');
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  if (id && isIdTagStatus(status)) await setIdTagStatus(id, status);
  revalidatePath('/admin/id-tags');
}

/** Save the onboarding settings: screening link + login/password + email bodies.
 *  An empty value clears the override (setSetting deletes the row), so blank ==
 *  "use the built-in default". The screening password lives only here, never in code. */
export async function saveIdTagSettingsAction(formData: FormData): Promise<void> {
  await requireAdminSection('id-tags');
  await Promise.all([
    setSetting(ID_TAG_SETTING_KEYS.screeningLink, String(formData.get('screeningLink') || '')),
    setSetting(ID_TAG_SETTING_KEYS.screeningLogin, String(formData.get('screeningLogin') || '')),
    setSetting(ID_TAG_SETTING_KEYS.screeningPassword, String(formData.get('screeningPassword') || '')),
    setSetting(ID_TAG_SETTING_KEYS.newEmailBody, String(formData.get('newEmailBody') || '')),
    setSetting(ID_TAG_SETTING_KEYS.existingEmailBody, String(formData.get('existingEmailBody') || '')),
  ]);
  revalidatePath('/admin/id-tags');
}
