'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { setSetting, MARKETPLACE_SETTING_KEYS } from '@/lib/settings';

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

  if (id) {
    await prisma.marketplaceItem.update({ where: { id }, data: { name, description, options, sortOrder, active } });
  } else {
    await prisma.marketplaceItem.create({
      data: { name, description, options, sortOrder, active, createdById: session.userId },
    });
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
