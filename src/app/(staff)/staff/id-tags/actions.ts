'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffSection } from '@/lib/session';
import {
  setDealerIdTagPassword, setDealerEntuitiveProfile, OFFICE_PROFILE_FIELDS,
  type OfficeEntuitiveProfile,
} from '@/lib/idTag';
import { setSetting, ID_TAG_SETTING_KEYS } from '@/lib/settings';

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
  revalidatePath('/staff/id-tags');
}
