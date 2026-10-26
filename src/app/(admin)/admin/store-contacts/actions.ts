'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminSection } from '@/lib/session';
import { audit } from '@/lib/audit';
import {
  upsertStoreContact, deleteStoreContact, importContactsCsv, setNationalRecipients,
} from '@/lib/hdStoreContacts';

export interface ContactsActionState { error?: string; ok?: boolean; summary?: string }

const str = (fd: FormData, k: string, max = 8000) => {
  const v = String(fd.get(k) ?? '').trim();
  return v ? v.slice(0, max) : null;
};

/** Create/update one store's recipients. */
export async function saveStoreContactAction(_prev: ContactsActionState, fd: FormData): Promise<ContactsActionState> {
  const session = await requireAdminSection('store-contacts');
  const storeNumber = String(fd.get('storeNumber') ?? '').replace(/\D/g, '').slice(0, 5);
  if (!/^7\d{3}$/.test(storeNumber)) return { error: 'Enter a valid 4-digit store number starting with 7 (e.g. 7024).' };

  await upsertStoreContact({
    storeNumber,
    storeName: str(fd, 'storeName', 120),
    district: str(fd, 'district', 80),
    storeContacts: str(fd, 'storeContacts'),
    ism: str(fd, 'ism'),
    distributor: str(fd, 'distributor'),
    officeManager: str(fd, 'officeManager'),
    active: String(fd.get('active') ?? '') === 'on',
  });
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'HdStoreContact', entityId: storeNumber, detail: `Store contacts saved (${storeNumber})` });
  revalidatePath('/admin/store-contacts');
  redirect('/admin/store-contacts');
}

/** Delete one store's recipient record. */
export async function deleteStoreContactAction(storeNumber: string, _formData?: FormData): Promise<void> {
  const session = await requireAdminSection('store-contacts');
  await deleteStoreContact(storeNumber);
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'HdStoreContact', entityId: storeNumber, detail: `Store contacts deleted (${storeNumber})` });
  revalidatePath('/admin/store-contacts');
  redirect('/admin/store-contacts');
}

/** Import the GWA contacts sheet (pasted CSV): upsert every store + national list. */
export async function importContactsAction(_prev: ContactsActionState, fd: FormData): Promise<ContactsActionState> {
  const session = await requireAdminSection('store-contacts');
  const csv = String(fd.get('csv') ?? '');
  if (csv.trim().length < 20) return { error: 'Paste the contacts CSV (store rows) first.' };
  const res = await importContactsCsv(csv);
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'HdStoreContact', entityId: 'import', detail: `Imported ${res.imported} store contacts, ${res.national} national` });
  revalidatePath('/admin/store-contacts');
  return { ok: true, summary: `Imported ${res.imported} stores · ${res.national} national recipients${res.skipped.length ? ` · ${res.skipped.length} row(s) skipped (no store #)` : ''}.` };
}

/** Save the National report recipient list. */
export async function saveNationalRecipientsAction(_prev: ContactsActionState, fd: FormData): Promise<ContactsActionState> {
  const session = await requireAdminSection('store-contacts');
  await setNationalRecipients(String(fd.get('national') ?? ''));
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'HdStoreContact', entityId: 'national', detail: 'National recipients updated' });
  revalidatePath('/admin/store-contacts');
  return { ok: true, summary: 'National recipient list saved.' };
}
