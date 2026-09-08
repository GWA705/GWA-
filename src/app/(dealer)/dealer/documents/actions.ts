'use server';

import { revalidatePath } from 'next/cache';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { putDocument, deleteDocument, newDealerDocStorageKey } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { BUSINESS_DOC_TYPE_KEYS, OTHER_DOC_TYPE, DOC_MAX_BYTES } from '@/lib/constants';

export interface DocActionState {
  error?: string;
  ok?: boolean;
}

const ALLOWED_MIME = /^(application\/pdf|image\/(png|jpe?g|webp|heic|heif))$/i;

function extFrom(name: string, mime: string): string {
  const m = name.match(/\.[a-z0-9]{1,5}$/i);
  if (m) return m[0].toLowerCase();
  if (mime === 'application/pdf') return '.pdf';
  if (mime.startsWith('image/')) return `.${mime.split('/')[1].replace('jpeg', 'jpg')}`;
  return '.bin';
}

/** A dealer uploads (or replaces) one business/compliance document. */
export async function uploadDocumentAction(_prev: DocActionState, formData: FormData): Promise<DocActionState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'Your account is not linked to a dealer.' };
  const dealerId = session.dealerId;

  const type = (formData.get('type') ?? '').toString().trim();
  const isFixed = BUSINESS_DOC_TYPE_KEYS.includes(type);
  const isOther = type === OTHER_DOC_TYPE;
  if (!isFixed && !isOther) return { error: 'Unknown document type.' };

  const label = (formData.get('label') ?? '').toString().trim() || null;
  if (isOther && !label) return { error: 'Please give this document a name.' };

  const accountNumber = (formData.get('accountNumber') ?? '').toString().trim().slice(0, 40) || null;

  // Expiry is required for the fixed types (WSIB/WCB expire — that's the whole
  // point); optional for a custom document that may not expire.
  const expiryRaw = (formData.get('expiryDate') ?? '').toString().trim();
  let expiryDate: Date | null = null;
  if (expiryRaw) {
    const d = new Date(`${expiryRaw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return { error: 'That expiry date is not valid.' };
    expiryDate = d;
  } else if (isFixed) {
    return { error: 'Please enter the expiry / renewal date shown on the document.' };
  }

  const scannedDates = (formData.get('scannedDates') ?? '').toString().split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const autoExtracted = (formData.get('autoExtracted') ?? '').toString() === '1';

  const file = formData.get('file');
  if (!(file instanceof Blob) || file.size === 0) return { error: 'Please choose a file to upload.' };
  if (file.size > DOC_MAX_BYTES) return { error: 'That file is larger than 10 MB.' };
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.test(mimeType)) return { error: 'Upload a PDF or an image (PNG/JPG).' };
  const fileName = (file instanceof File ? file.name : '') || `${type}${extFrom('', mimeType)}`;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return { error: 'Could not read that file. Please try again.' };
  }

  const storageKey = newDealerDocStorageKey(dealerId, extFrom(fileName, mimeType));
  try {
    await putDocument(storageKey, bytes);
  } catch (e) {
    console.error('[dealer-docs] store failed', e);
    return { error: 'Upload failed while saving the file. Please try again.' };
  }

  const data = {
    type,
    label: isOther ? label : null,
    storageKey,
    fileName: fileName.slice(0, 200),
    mimeType,
    fileSize: bytes.length,
    accountNumber,
    expiryDate,
    scannedDates,
    autoExtracted,
    uploadedById: session.userId,
    // Replacing the file starts the reminder clock over for the new expiry.
    remindersSent: 0,
    lastRemindedAt: null,
  };

  try {
    // Fixed types have a single "current" row per dealer — replace it. Custom
    // documents are always added as new rows.
    const existing = isFixed
      ? await prisma.dealerDocument.findFirst({ where: { dealerId, type }, orderBy: { createdAt: 'desc' } })
      : null;

    if (existing) {
      const oldKey = existing.storageKey;
      await prisma.dealerDocument.update({ where: { id: existing.id }, data });
      if (oldKey && oldKey !== storageKey) await deleteDocument(oldKey).catch(() => {});
      await audit({ actorId: session.userId, action: 'DOC_UPLOAD', entityType: 'DealerDocument', entityId: existing.id, detail: `${type} replaced` });
    } else {
      const created = await prisma.dealerDocument.create({ data: { dealerId, ...data } });
      await audit({ actorId: session.userId, action: 'DOC_UPLOAD', entityType: 'DealerDocument', entityId: created.id, detail: type });
    }
  } catch (e) {
    console.error('[dealer-docs] db write failed', e);
    await deleteDocument(storageKey).catch(() => {});
    return { error: 'Upload failed while recording the document. Please try again.' };
  }

  revalidatePath('/dealer/documents');
  return { ok: true };
}

/** Delete one of the dealer's own documents. */
export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return;
  const id = (formData.get('id') ?? '').toString();
  if (!id) return;

  const doc = await prisma.dealerDocument.findUnique({ where: { id }, select: { dealerId: true, storageKey: true, type: true } });
  if (!doc || doc.dealerId !== session.dealerId) return;

  await prisma.dealerDocument.delete({ where: { id } });
  if (doc.storageKey) await deleteDocument(doc.storageKey).catch(() => {});
  await audit({ actorId: session.userId, action: 'DOCUMENT_DELETE', entityType: 'DealerDocument', entityId: id, detail: doc.type });
  revalidatePath('/dealer/documents');
}
