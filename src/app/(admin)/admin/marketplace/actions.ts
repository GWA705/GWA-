'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireAdminSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { toTitleCase, sentenceOrNull } from '@/lib/textcase';
import { MARKETPLACE_TAG_KEYS } from '@/lib/constants';
import { audit } from '@/lib/audit';
import { setSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';
import { putDocument, deleteDocument } from '@/lib/storage';
import { normalizeProductImage } from '@/lib/image';
import { MAX_FILE_BYTES, MARKETPLACE_FILE_MIME_TYPES } from '@/lib/constants';

// Validate + normalize an uploaded photo and store it, returning the new key.
async function storeItemImage(itemId: string, file: File): Promise<{ storageKey: string; mime: string; sizeBytes: number } | { error: string }> {
  if (file.size > MAX_FILE_BYTES) return { error: `Image is too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB).` };
  if (!file.type.startsWith('image/')) return { error: 'The photo must be an image (JPG, PNG, WEBP, HEIC).' };
  try {
    const { bytes, mime } = await normalizeProductImage(Buffer.from(await file.arrayBuffer()));
    const key = `marketplace/${itemId}/img-${crypto.randomBytes(6).toString('hex')}.webp`;
    await putDocument(key, bytes);
    return { storageKey: key, mime, sizeBytes: bytes.length };
  } catch (err) {
    console.error('[marketplace] image processing failed', err);
    return { error: 'Could not process that image. Try a different file.' };
  }
}

// Keep a filename safe to echo back in a Content-Disposition header later.
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'download';
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'download';
}

// Validate + store a downloadable file (PDF / image / zip) for a DOWNLOAD item.
async function storeItemFile(itemId: string, file: File): Promise<{ storageKey: string; fileName: string; mime: string; sizeBytes: number } | { error: string }> {
  if (file.size > MAX_FILE_BYTES) return { error: `File is too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB).` };
  if (!MARKETPLACE_FILE_MIME_TYPES.includes(file.type)) {
    return { error: 'Unsupported file type. Upload a PDF, image (JPG/PNG/WEBP), or ZIP.' };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] || '').toLowerCase();
    const key = `marketplace/${itemId}/file-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await putDocument(key, bytes);
    return { storageKey: key, fileName: safeFileName(file.name), mime: file.type, sizeBytes: bytes.length };
  } catch (err) {
    console.error('[marketplace] file storage failed', err);
    return { error: 'Could not save that file. Try again.' };
  }
}

export interface ItemActionState {
  error?: string;
  ok?: boolean;
}

export interface CategoryActionState {
  error?: string;
  ok?: boolean;
}

/** Create or rename/reorder a marketplace category. */
export async function saveCategoryAction(_prev: CategoryActionState, formData: FormData): Promise<CategoryActionState> {
  await requireAdminSection('marketplace');
  const id = (formData.get('id') ?? '').toString() || null;
  const name = toTitleCase((formData.get('name') ?? '').toString().trim());
  const sortOrder = Number.parseInt((formData.get('sortOrder') ?? '0').toString(), 10) || 0;
  if (!name) return { error: 'Category name is required.' };
  try {
    if (id) {
      await prisma.marketplaceCategory.update({ where: { id }, data: { name, sortOrder } });
    } else {
      await prisma.marketplaceCategory.create({ data: { name, sortOrder } });
    }
  } catch (err) {
    console.error('[marketplace] saveCategoryAction failed', err);
    return { error: 'Could not save this category. Please try again.' };
  }
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
  return { ok: true };
}

export async function toggleCategoryActiveAction(id: string) {
  await requireAdminSection('marketplace');
  const c = await prisma.marketplaceCategory.findUnique({ where: { id }, select: { active: true } });
  if (!c) return;
  await prisma.marketplaceCategory.update({ where: { id }, data: { active: !c.active } });
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
}

export async function deleteCategoryAction(id: string) {
  await requireAdminSection('marketplace');
  // Items in this category are kept — the FK sets their categoryId to null, so
  // they simply become uncategorized.
  await prisma.marketplaceCategory.delete({ where: { id } }).catch(() => {});
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
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
  const session = await requireAdminSection('marketplace');
  const id = (formData.get('id') ?? '').toString() || null;
  const name = toTitleCase((formData.get('name') ?? '').toString().trim());
  const partNumber = (formData.get('partNumber') ?? '').toString().trim() || null;
  const description = sentenceOrNull((formData.get('description') ?? '').toString());
  const options = parseOptions((formData.get('options') ?? '').toString());
  const sortOrder = Number.parseInt((formData.get('sortOrder') ?? '0').toString(), 10) || 0;
  const active = formData.get('active') === 'on';
  const featured = formData.get('featured') === 'on';
  // Keep only recognised tag keys, in the canonical order.
  const picked = new Set(formData.getAll('tags').map(String));
  const tags = MARKETPLACE_TAG_KEYS.filter((k) => picked.has(k));
  const categoryId = (formData.get('categoryId') ?? '').toString() || null;
  const kind = (formData.get('kind') ?? 'ORDER').toString() === 'DOWNLOAD' ? 'DOWNLOAD' : 'ORDER';

  if (!name) return { error: 'Item name is required.' };

  const image = formData.get('image') as File | null;
  const hasNewImage = !!image && typeof image !== 'string' && image.size > 0;
  const removeImage = formData.get('removeImage') === 'on';

  const file = formData.get('file') as File | null;
  const hasNewFile = !!file && typeof file !== 'string' && file.size > 0;
  const removeFile = formData.get('removeFile') === 'on';

  // Any failure below (DB, storage, image processing) is returned to the form as
  // a friendly message rather than thrown — an unhandled throw here would tear
  // down the whole page with a generic "client-side exception" error.
  try {
    if (id) {
      const existing = await prisma.marketplaceItem.findUnique({ where: { id }, select: { imageStorageKey: true, fileStorageKey: true } });
      if (!existing) return { error: 'That item no longer exists — reload the page and try again.' };
      await prisma.marketplaceItem.update({ where: { id }, data: { name, partNumber, description, options, sortOrder, active, featured, tags, categoryId, kind } });
      if (hasNewImage) {
        const stored = await storeItemImage(id, image!);
        if ('error' in stored) return { error: stored.error };
        if (existing.imageStorageKey) await deleteDocument(existing.imageStorageKey).catch(() => {});
        await prisma.marketplaceItem.update({ where: { id }, data: { imageStorageKey: stored.storageKey, imageMime: stored.mime, imageSizeBytes: stored.sizeBytes } });
      } else if (removeImage && existing.imageStorageKey) {
        await deleteDocument(existing.imageStorageKey).catch(() => {});
        await prisma.marketplaceItem.update({ where: { id }, data: { imageStorageKey: null, imageMime: null, imageSizeBytes: null } });
      }
      if (hasNewFile) {
        const stored = await storeItemFile(id, file!);
        if ('error' in stored) return { error: stored.error };
        if (existing.fileStorageKey) await deleteDocument(existing.fileStorageKey).catch(() => {});
        await prisma.marketplaceItem.update({ where: { id }, data: { fileStorageKey: stored.storageKey, fileName: stored.fileName, fileMime: stored.mime, fileSizeBytes: stored.sizeBytes } });
      } else if (removeFile && existing.fileStorageKey) {
        await deleteDocument(existing.fileStorageKey).catch(() => {});
        await prisma.marketplaceItem.update({ where: { id }, data: { fileStorageKey: null, fileName: null, fileMime: null, fileSizeBytes: null } });
      }
    } else {
      const created = await prisma.marketplaceItem.create({
        data: { name, partNumber, description, options, sortOrder, active, featured, tags, categoryId, kind, createdById: session.userId },
      });
      if (hasNewImage) {
        const stored = await storeItemImage(created.id, image!);
        if ('error' in stored) return { error: stored.error };
        await prisma.marketplaceItem.update({ where: { id: created.id }, data: { imageStorageKey: stored.storageKey, imageMime: stored.mime, imageSizeBytes: stored.sizeBytes } });
      }
      if (hasNewFile) {
        const stored = await storeItemFile(created.id, file!);
        if ('error' in stored) return { error: stored.error };
        await prisma.marketplaceItem.update({ where: { id: created.id }, data: { fileStorageKey: stored.storageKey, fileName: stored.fileName, fileMime: stored.mime, fileSizeBytes: stored.sizeBytes } });
      }
    }
  } catch (err) {
    console.error('[marketplace] saveItemAction failed', err);
    return { error: 'Could not save this item. Please try again in a moment.' };
  }

  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
  return { ok: true };
}

export async function toggleItemActiveAction(id: string) {
  await requireAdminSection('marketplace');
  const item = await prisma.marketplaceItem.findUnique({ where: { id }, select: { active: true } });
  if (!item) return;
  await prisma.marketplaceItem.update({ where: { id }, data: { active: !item.active } });
  revalidatePath('/admin/marketplace');
  revalidatePath('/dealer/marketplace');
}

export async function deleteItemAction(id: string) {
  await requireAdminSection('marketplace');
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
  const session = await requireAdminSection('marketplace');
  await setSetting(MARKETPLACE_SETTING_KEYS.orderEmail, (formData.get('orderEmail') ?? '').toString());
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'AppSetting', entityId: MARKETPLACE_SETTING_KEYS.orderEmail });
  revalidatePath('/admin/marketplace');
  return { ok: true };
}
