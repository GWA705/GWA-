'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdminSection } from '@/lib/session';
import { audit } from '@/lib/audit';
import { deleteDocument } from '@/lib/storage';
import { storeResourceBlob } from '@/lib/resourceLibrary';
import { MAX_RESOURCE_FILE_BYTES } from '@/lib/constants';
import { toTitleCase } from '@/lib/textcase';
import type { ResourceFileKind } from '@prisma/client';

export interface ActionState {
  error?: string;
}

const KINDS: ResourceFileKind[] = ['MANUAL', 'BROCHURE', 'SPEC_SHEET', 'WARRANTY', 'OTHER'];
function parseKind(v: FormDataEntryValue | null): ResourceFileKind {
  return KINDS.includes(v as ResourceFileKind) ? (v as ResourceFileKind) : 'OTHER';
}
function str(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

export async function createResourceProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('resource-library');
  const title = str(formData.get('title'));
  if (!title) return { error: 'Give the product a name.' };

  const created = await prisma.resourceProduct.create({
    data: {
      title: toTitleCase(title),
      journalName: str(formData.get('journalName')),
      category: str(formData.get('category')),
      brand: str(formData.get('brand')),
      modelNumber: str(formData.get('modelNumber')),
      description: str(formData.get('description')),
      createdById: session.userId,
    },
  });

  const photo = formData.get('image');
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeResourceBlob(`resource-products/${created.id}`, photo, { imageOnly: true });
    if (!('error' in stored)) {
      await prisma.resourceProduct.update({
        where: { id: created.id },
        data: { imageStorageKey: stored.key, imageMime: stored.mime },
      });
    }
  }

  // Optional manual + brochure uploaded right on the add form — each becomes a
  // resource file of the matching kind.
  const initialFiles: { field: string; kind: ResourceFileKind }[] = [
    { field: 'manual', kind: 'MANUAL' },
    { field: 'brochure', kind: 'BROCHURE' },
  ];
  let order = 0;
  for (const { field, kind } of initialFiles) {
    const f = formData.get(field);
    if (!(f instanceof File) || f.size === 0) continue;
    const stored = await storeResourceBlob(`resource-products/${created.id}/files`, f, { maxBytes: MAX_RESOURCE_FILE_BYTES });
    if ('error' in stored) continue;
    order += 1;
    await prisma.resourceProductFile.create({
      data: {
        productId: created.id,
        kind,
        storageKey: stored.key,
        mime: stored.mime,
        sizeBytes: stored.size,
        originalName: stored.name,
        thumbStorageKey: stored.thumbKey ?? null,
        thumbMime: stored.thumbMime ?? null,
        sortOrder: order,
      },
    });
  }

  await audit({ actorId: session.userId, action: 'CONTENT_CREATE', entityType: 'ResourceProduct', entityId: created.id, detail: `resource product: ${title}` });
  redirect(`/admin/resource-library/${created.id}`);
}

export async function updateResourceProductAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('resource-library');
  const title = str(formData.get('title'));
  if (!title) return { error: 'Give the product a name.' };

  const existing = await prisma.resourceProduct.findUnique({ where: { id }, select: { imageStorageKey: true } });
  if (!existing) return { error: 'Product not found.' };

  await prisma.resourceProduct.update({
    where: { id },
    data: {
      title: toTitleCase(title),
      journalName: str(formData.get('journalName')),
      category: str(formData.get('category')),
      brand: str(formData.get('brand')),
      modelNumber: str(formData.get('modelNumber')),
      description: str(formData.get('description')),
    },
  });

  // Photo: replace or remove.
  const removePhoto = formData.get('removeImage') === 'on';
  const photo = formData.get('image');
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeResourceBlob(`resource-products/${id}`, photo, { imageOnly: true });
    if ('error' in stored) return { error: stored.error };
    await prisma.resourceProduct.update({ where: { id }, data: { imageStorageKey: stored.key, imageMime: stored.mime } });
    if (existing.imageStorageKey) await deleteDocument(existing.imageStorageKey).catch(() => {});
  } else if (removePhoto && existing.imageStorageKey) {
    await deleteDocument(existing.imageStorageKey).catch(() => {});
    await prisma.resourceProduct.update({ where: { id }, data: { imageStorageKey: null, imageMime: null } });
  }

  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ResourceProduct', entityId: id, detail: `edited: ${title}` });
  revalidatePath('/admin/resource-library');
  revalidatePath(`/admin/resource-library/${id}`);
  return {};
}

export async function toggleResourceProductActiveAction(id: string): Promise<void> {
  const session = await requireAdminSection('resource-library');
  const p = await prisma.resourceProduct.findUnique({ where: { id }, select: { active: true } });
  if (!p) return;
  await prisma.resourceProduct.update({ where: { id }, data: { active: !p.active } });
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ResourceProduct', entityId: id, detail: `active=${!p.active}` });
  revalidatePath('/admin/resource-library');
}

export async function deleteResourceProductAction(id: string): Promise<void> {
  const session = await requireAdminSection('resource-library');
  const p = await prisma.resourceProduct.findUnique({
    where: { id },
    select: { imageStorageKey: true, files: { select: { storageKey: true, thumbStorageKey: true } } },
  });
  if (!p) return;
  await prisma.resourceProduct.delete({ where: { id } }); // cascades files
  if (p.imageStorageKey) await deleteDocument(p.imageStorageKey).catch(() => {});
  for (const f of p.files) {
    await deleteDocument(f.storageKey).catch(() => {});
    if (f.thumbStorageKey) await deleteDocument(f.thumbStorageKey).catch(() => {});
  }
  await audit({ actorId: session.userId, action: 'CONTENT_UPDATE', entityType: 'ResourceProduct', entityId: id, detail: 'deleted' });
  redirect('/admin/resource-library');
}

export async function addResourceFileAction(productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdminSection('resource-library');
  const product = await prisma.resourceProduct.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { error: 'Product not found.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to upload.' };
  const stored = await storeResourceBlob(`resource-products/${productId}/files`, file, { maxBytes: MAX_RESOURCE_FILE_BYTES });
  if ('error' in stored) return { error: stored.error };

  const kind = parseKind(formData.get('kind'));
  const max = await prisma.resourceProductFile.aggregate({ where: { productId }, _max: { sortOrder: true } });
  await prisma.resourceProductFile.create({
    data: {
      productId,
      kind,
      label: str(formData.get('label')),
      storageKey: stored.key,
      mime: stored.mime,
      sizeBytes: stored.size,
      originalName: stored.name,
      thumbStorageKey: stored.thumbKey ?? null,
      thumbMime: stored.thumbMime ?? null,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  await audit({ actorId: session.userId, action: 'DOC_UPLOAD', entityType: 'ResourceProductFile', entityId: productId, detail: `${kind} added` });
  revalidatePath(`/admin/resource-library/${productId}`);
  return {};
}

export async function deleteResourceFileAction(fileId: string): Promise<void> {
  const session = await requireAdminSection('resource-library');
  const f = await prisma.resourceProductFile.findUnique({ where: { id: fileId }, select: { productId: true, storageKey: true, thumbStorageKey: true } });
  if (!f) return;
  await prisma.resourceProductFile.delete({ where: { id: fileId } });
  await deleteDocument(f.storageKey).catch(() => {});
  if (f.thumbStorageKey) await deleteDocument(f.thumbStorageKey).catch(() => {});
  await audit({ actorId: session.userId, action: 'DOCUMENT_DELETE', entityType: 'ResourceProductFile', entityId: fileId, detail: 'resource file deleted' });
  revalidatePath(`/admin/resource-library/${f.productId}`);
}
