'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { putDocument, newScannedLeadStorageKey } from '@/lib/storage';
import { resolveDealerIdForStore, getScannedLeadForViewer } from '@/lib/scannedLeads';

export interface ScanSaveState { ok?: boolean; error?: string; id?: string }

const str = (fd: FormData, k: string): string | null => {
  const v = String(fd.get(k) ?? '').trim();
  return v.length ? v.slice(0, 2000) : null;
};
const bool = (fd: FormData, k: string): boolean | null => {
  const v = String(fd.get(k) ?? '').trim().toLowerCase();
  if (v === 'true' || v === 'yes') return true;
  if (v === 'false' || v === 'no') return false;
  return null;
};
const jsonArr = (fd: FormData, k: string): string[] => {
  try {
    const v = JSON.parse(String(fd.get(k) ?? '[]'));
    return Array.isArray(v) ? v.map(String).slice(0, 40) : [];
  } catch {
    return [];
  }
};

const STATUSES = ['NEW', 'CONTACTED', 'NO_GOOD'];

/**
 * Save a confirmed scanned lead card. Accepts the edited fields plus the primary
 * photo (best-effort stored). Dealers save to their own office; staff attribute by
 * the card's store number when it maps to a dealer, else it stays unassigned.
 */
export async function createScannedLeadAction(_prev: ScanSaveState, fd: FormData): Promise<ScanSaveState> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };
  const staff = isInternalRole(user.role);
  if (!staff && !user.dealerId) return { error: 'Your account can’t save lead cards.' };

  const storeNumber = str(fd, 'storeNumber');
  const dealerId = staff ? await resolveDealerIdForStore(storeNumber) : user.dealerId ?? null;

  const customerName = str(fd, 'customerName');
  const phone = str(fd, 'phone');
  if (!customerName && !phone) return { error: 'Enter at least a name or a phone number.' };

  // Store the primary photo (best-effort — a storage hiccup shouldn't lose the lead).
  let photoStorageKey: string | null = null;
  let photoMime: string | null = null;
  const photo = fd.get('photo');
  if (photo instanceof File && photo.size > 0 && photo.size <= 12 * 1024 * 1024) {
    try {
      const ext = photo.type === 'image/png' ? '.png' : photo.type === 'image/webp' ? '.webp' : '.jpg';
      const key = newScannedLeadStorageKey(dealerId, ext);
      await putDocument(key, Buffer.from(await photo.arrayBuffer()));
      photoStorageKey = key;
      photoMime = photo.type || 'image/jpeg';
    } catch (e) {
      console.error('[scanned-lead] photo store failed', e);
    }
  }

  const confRaw = Number(String(fd.get('confidence') ?? ''));
  const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(100, Math.round(confRaw))) : null;

  const lead = await prisma.scannedLead.create({
    data: {
      dealerId,
      scannedById: user.userId,
      scannedByName: user.name,
      customerName,
      phone,
      occupation: str(fd, 'occupation'),
      spouseName: str(fd, 'spouseName'),
      spousePhone: str(fd, 'spousePhone'),
      spouseOccupation: str(fd, 'spouseOccupation'),
      address: str(fd, 'address'),
      city: str(fd, 'city'),
      postalCode: str(fd, 'postalCode'),
      bestTimeToContact: str(fd, 'bestTimeToContact'),
      waterNotes: str(fd, 'waterNotes'),
      ownsHome: str(fd, 'ownsHome'),
      waterSource: str(fd, 'waterSource'),
      waterQuality: str(fd, 'waterQuality'),
      conditions: jsonArr(fd, 'conditions'),
      buysBottledWater: bool(fd, 'buysBottledWater'),
      hasFilters: bool(fd, 'hasFilters'),
      hasWellWater: bool(fd, 'hasWellWater'),
      householdSize: str(fd, 'householdSize'),
      storeNumber,
      collectedOn: str(fd, 'collectedOn'),
      generatorName: str(fd, 'generatorName'),
      confidence,
      uncertainFields: jsonArr(fd, 'uncertainFields'),
      rawJson: str(fd, 'rawJson'),
      photoStorageKey,
      photoMime,
      note: str(fd, 'note'),
    },
  });

  await audit({
    actorId: user.userId,
    action: 'STATUS_CHANGE',
    entityType: 'ScannedLead',
    entityId: lead.id,
    detail: `Scanned lead saved${storeNumber ? ` (store ${storeNumber})` : ''}${dealerId ? '' : ' — unassigned'}`,
  });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return { ok: true, id: lead.id };
}

/** Update a scanned lead's follow-up status (NEW / CONTACTED / NO_GOOD). */
export async function setScannedLeadStatusAction(id: string, status: string): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };
  if (!STATUSES.includes(status)) return { error: 'Unknown status.' };
  const lead = await getScannedLeadForViewer(id, user);
  if (!lead) return { error: 'Not found.' };
  await prisma.scannedLead.update({ where: { id }, data: { status } });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}

/** Remove a scanned lead (its owning office, or any GWA staff). */
export async function deleteScannedLeadAction(id: string): Promise<{ error?: string }> {
  const user = await getSession();
  if (!user) return { error: 'Please sign in again.' };
  const lead = await getScannedLeadForViewer(id, user);
  if (!lead) return { error: 'Not found.' };
  await prisma.scannedLead.delete({ where: { id } });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ScannedLead', entityId: id, detail: 'Scanned lead deleted' });
  revalidatePath('/dealer/leads');
  revalidatePath('/staff/leads');
  return {};
}
