'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { audit } from '@/lib/audit';
import { setSetting, SEARCH_SETTING_KEYS } from '@/lib/settings';
import { findCustomerData, recordDataAccess, eraseCustomerTextingData, type CustomerDataFound } from '@/lib/customerData';

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

// ── Customer data requests (access & erasure) — PIPEDA s.8/4.9 ─────────────

export async function findCustomerDataAction(_prev: unknown, formData: FormData): Promise<{ data?: CustomerDataFound; error?: string; notFound?: boolean }> {
  const session = await requireAdminSection('security');
  const phone = String(formData.get('phone') || '').trim();
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Enter a 10-digit phone number.' };
  const data = await findCustomerData(phone);
  if (!data) return { notFound: true };
  await recordDataAccess(phone, session.userId);
  return { data };
}

export async function eraseCustomerDataAction(_prev: unknown, formData: FormData): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const session = await requireAdminSection('security');
  const phone = String(formData.get('phone') || '').trim();
  const confirm = String(formData.get('confirm') || '');
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Enter a 10-digit phone number.' };
  if (confirm !== 'ERASE') return { error: 'Type ERASE to confirm the deletion.' };
  const r = await eraseCustomerTextingData(phone, session.userId);
  revalidatePath('/admin/security/data-request');
  return { ok: true, message: `Erased ${r.textsDeleted} text records and ${r.leadsDeleted} leads. Number kept on the do-not-contact list. Funded deals/cases were retained (legal requirement).` };
}
