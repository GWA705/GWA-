'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffSection } from '@/lib/session';
import { setDealerIdTagPassword } from '@/lib/idTag';

/**
 * Save (or clear, when blank) one office's standardized Home Depot ID-tag
 * password — the password that goes into every new-rep onboarding email so the
 * Entuitive screening sign-in is the same every time for that office. Reviewers
 * and admins with the 'id-tags' section can set these.
 */
export async function saveOfficeIdTagPasswordAction(formData: FormData): Promise<void> {
  await requireStaffSection('id-tags');
  const dealerId = String(formData.get('dealerId') || '').trim();
  const password = String(formData.get('password') || '').trim();
  if (dealerId) await setDealerIdTagPassword(dealerId, password);
  revalidatePath('/staff/id-tags');
}
