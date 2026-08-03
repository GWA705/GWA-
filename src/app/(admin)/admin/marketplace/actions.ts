'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { setSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { putDocument, deleteDocument } from '@/lib/storage';
import { normalizeProductImage } from '@/lib/image';
import { MAX_FILE_BYTES } from '@/lib/constants';

// Validate + normalize an uploaded photo and store it, returning the new key.
async function storeItemImage(itemId: string, file: File): Promise<{ storageKey: string; mime: string } | { error: string }> {
  if (file.size > MAX_FILE_BYTES) return { error: `Image is too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB).` };
  if (!file.type.startsWith('image/')) return { error: 'The photo must be an image (JPG, PNG, WEBP, HEIC).' };
  try {
    const { bytes, mime } = await normalizeProductImage(Buffer.from(await file.arrayBuffer()));
    const key = `marketplace/${itemId}/img-${crypto.randomBytes(6).toString('hex')}.webp`;
    await putDocument(key, bytes);
    return { storageKey: key, mime };
  } catch (err) {
    console.error('[marketplace] image processing failed', err);
    return { error: 'Could not process that image. Try a different file.' };
  }
}

export interface ItemActionState {
  error?: string;
  ok?: boolean;
}

function parseOptions(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/** Create or update a marketplace item. */
export async function saveItemAction(_prev: ItemActionState, formData: FormData): Promise<ItemActionState> {
  const session = await requireRole('ADMIN');
  const id = (formData.get('id') ?? '').toString() || null;
  const name = (formData.get('name') ?? '').toString().trim();
  const description = (formData.get('description') ?? '').toString().trim() || null;
  const options = parseOptions((formData.get('options') ?? '').toString());
  const sortOrder = Number.parseInt((formData.get('sortOrder') ?? '0').toString(), 10) || 0;
  const active = formData.get('active') === 'on';

  if (!name) return { error: 'Item name is required.' };

  const image = formData.get('image') as File | null;
  const hasNewImage = !!image && typeof image !== 'string' && image.size > 0;
  const removeImage = formData.get('removeImage') === 'on';

  if (id) {
    const existing = await prisma.marketplaceItem.findUnique({ where: { id }, select: { imageStorageKey: true } });
    await prisma.marketplaceItem.update({ where: { id }, data: { name, description, options, sortOrder, active } });
    if (hasNewImage) {
      const stored = await storeItemImage(id, image!);
      if ('error' in stored) return { error: stored.error };
      if (existing?.imageStorageKey) await deleteDocument(existing.imageStorageKey).catch(() => {});
      await prisma.marketplaceItem.update({ where: { id }, data: { imageStorageKey: stored.storageKey, imageMime: stored.mime } });
    } else if (removeImage && existing?.imageStorageKey) {
      await deleteDocument(existing.imageStorageKey).catch(() => {});
      await prisma.marketplaceItem.update({ where: { id }, data: { imageStorageKey: null, imageMime: null } });
    }
  } else {
    const created = await prisma.marketplaceItem.create({
      data: { name, description, options, sortOrder, active, createdById: session.userId },
    });
    if (hasNewImage) {
      const stored = await storeItemImage(created.id, image!);
      if ('error' in stored) return { error: stored.error };
      await prisma.marketplaceItem.update({ where: { id: created.id }, data: { imageStorageKey: stored.storageKey, imageMime: stored.mime } });
    }
  }
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
  return { ok: true };
}

export async function toggleItemActiveAction(id: string) {
  await requireRole('ADMIN');
  const item = await prisma.marketplaceItem.findUnique({ where: { id }, select: { active: true } });
  if (!item) return;
  await prisma.marketplaceItem.update({ where: { id }, data: { active: !item.active } });
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
}

export async function deleteItemAction(id: string) {
  await requireRole('ADMIN');
  // Keep past orders intact — only delete when nothing references the item.
  const uses = await prisma.orderItem.count({ where: { itemId: id } });
  if (uses > 0) {
    await prisma.marketplaceItem.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.marketplaceItem.delete({ where: { id } });
  }
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
}

/** Save where marketplace order emails should go (blank = all admins). */
export async function saveOrderEmailAction(_prev: { ok?: boolean }, formData: FormData): Promise<{ ok?: boolean }> {
  const session = await requireRole('ADMIN');
  await setSetting(MARKETPLACE_SETTING_KEYS.orderEmail, (formData.get('orderEmail') ?? '').toString());
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'AppSetting', entityId: MARKETPLACE_SETTING_KEYS.orderEmail });
  revalidatePath('/admin/marketplace');
  return { ok: true };
}
