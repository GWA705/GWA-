'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { setIdTagStatus, isIdTagStatus, setIdTagEnabledOffices, deleteIdTag } from '@/lib/idTag';
import { setSetting, ID_TAG_SETTING_KEYS } from '@/lib/settings';
import { sendIdTagNewRepEmail, sendIdTagExistingRepEmail } from '@/lib/idTag-email';
import { emailEnabled } from '@/lib/email';

export interface IdTagPreviewState {
  ok?: boolean;
  error?: string;
  message?: string;
}

/**
 * Email the current admin a PREVIEW of both ID-tag emails (new-rep background-
 * screening + existing-rep welcome), built with the live settings and sample
 * data — so they can see exactly what a rep receives, including the screening
 * link. Sends to the admin's own address.
 */
export async function sendIdTagEmailPreviewAction(): Promise<IdTagPreviewState> {
  const session = await requireAdminSection('id-tags');
  const to = (session.email || '').trim();
  if (!to) return { error: 'Your account has no email address to send a preview to.' };
  if (!emailEnabled()) return { error: 'Email is off here (log-only) — nothing was sent. Turn SMTP on to preview.' };
  const okNew = await sendIdTagNewRepEmail(to, 'Sample Rep');
  const okExisting = await sendIdTagExistingRepEmail(to, 'Sample Rep', 'Your Office');
  if (!okNew && !okExisting) return { error: 'Could not send the preview — check the email settings.' };
  return { ok: true, message: `Preview sent to ${to} — the new-rep (background screening) and existing-rep emails.` };
}

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

/** Permanently delete one ID-tag request (and its stored files). */
export async function deleteIdTagAction(formData: FormData): Promise<void> {
  await requireAdminSection('id-tags');
  const id = String(formData.get('id') || '').trim();
  if (id) await deleteIdTag(id);
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
