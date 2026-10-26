'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireStaffSection } from '@/lib/session';
import {
  setDealerIdTagPassword, setDealerEntuitiveProfile, OFFICE_PROFILE_FIELDS,
  setIdTagStatus, isIdTagStatus, setIdTagCardInfo, saveIdTagHeadshot, deleteIdTag,
  type OfficeEntuitiveProfile,
} from '@/lib/idTag';
import { setSetting, ID_TAG_SETTING_KEYS } from '@/lib/settings';
import { putDocument } from '@/lib/storage';

/**
 * Save one office's ID-tag setup: the standardized Entuitive password + the
 * office's Entuitive "New User" profile (company name, address, phone, province,
 * service) that auto-fills every person's setup sheet. Reviewers and admins with
 * the 'id-tags' section can set these.
 */
export async function saveOfficeSetupAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const dealerId = String(formData.get('dealerId') || '').trim();
  if (!dealerId) return;
  const password = String(formData.get('password') || '').trim();
  const profile: OfficeEntuitiveProfile = {};
  for (const k of OFFICE_PROFILE_FIELDS) profile[k] = String(formData.get(k) || '').trim();
  await Promise.all([
    setDealerIdTagPassword(dealerId, password),
    setDealerEntuitiveProfile(dealerId, profile),
  ]);
  revalidatePath('/staff/id-tags');
}

/** Change who the monthly ID-tag billing/activation list is emailed to. Blank
 *  clears the override (falls back to the built-in defaults). */
export async function saveBillingRecipientsAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const raw = String(formData.get('recipients') || '').trim();
  await setSetting(ID_TAG_SETTING_KEYS.billingRecipients, raw);
  revalidatePath('/staff/id-tags/setup');
}

/** Move one person to a new status (reviewer control on the detail view). */
export async function updateIdTagStatusStaffAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const id = String(formData.get('id') || '').trim();
  const status = String(formData.get('status') || '');
  if (id && isIdTagStatus(status)) await setIdTagStatus(id, status);
  if (id) revalidatePath(`/staff/id-tags/${id}`);
  revalidatePath('/staff/id-tags');
}

/** Reviewer: permanently delete an ID-tag record (and its files), then return
 *  to the board. */
export async function deleteIdTagStaffAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const id = String(formData.get('id') || '').trim();
  if (id) await deleteIdTag(id);
  revalidatePath('/staff/id-tags');
  redirect('/staff/id-tags');
}

/** Reviewer: change/replace a person's headshot. */
export async function uploadIdTagHeadshotStaffAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const id = String(formData.get('id') || '').trim();
  if (!id) return;
  await saveIdTagHeadshot(id, formData.get('headshot') as File | null);
  revalidatePath(`/staff/id-tags/${id}`);
  revalidatePath('/staff/id-tags');
}

/** Save the card-side fields from the Entuitive card: valid-until, badge #,
 *  Entuitive status, and (optionally) upload the finished QR card file. */
export async function saveIdTagCardAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const id = String(formData.get('id') || '').trim();
  if (!id) return;
  const validUntilRaw = String(formData.get('validUntil') || '').trim();
  const badgeNumber = String(formData.get('badgeNumber') || '').trim();
  const entuitiveStatus = String(formData.get('entuitiveStatus') || '').trim();

  // Optional finished-card upload → S3. Best-effort.
  let cardFileKey: string | undefined;
  const file = formData.get('card');
  if (file && typeof file === 'object' && 'arrayBuffer' in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size <= 15 * 1024 * 1024) {
      try {
        const buf = Buffer.from(await f.arrayBuffer());
        const ext = (f.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.pdf').toLowerCase();
        cardFileKey = `idtags/${id}/card-${Date.now()}${ext}`;
        await putDocument(cardFileKey, buf);
      } catch (e) {
        console.error('[idTag] card upload failed', e);
        cardFileKey = undefined;
      }
    }
  }

  await setIdTagCardInfo(id, {
    validUntil: validUntilRaw ? new Date(`${validUntilRaw}T00:00:00`) : null,
    badgeNumber: badgeNumber || null,
    entuitiveStatus: entuitiveStatus || null,
    ...(cardFileKey ? { cardFileKey } : {}),
  });
  revalidatePath(`/staff/id-tags/${id}`);
  revalidatePath('/staff/id-tags');
}
