'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { audit } from '@/lib/audit';
import crypto from 'crypto';
import path from 'path';
import { putDocument, deleteDocument } from '@/lib/storage';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/constants';
import { createUserSchema, createDealerSchema, createFinanceCompanySchema, announcementSchema } from '@/lib/validation';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export async function createDealerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('ADMIN');
  const parsed = createDealerSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: 'Enter a dealer name.' };

  const dealer = await prisma.dealer.create({ data: { name: parsed.data.name } });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'Dealer', entityId: dealer.id, detail: dealer.name });
  revalidatePath('/admin/dealers');
  return { ok: true };
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('ADMIN');
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    dealerId: formData.get('dealerId') || undefined,
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Please check the fields and try again.' };
  const d = parsed.data;

  const pwError = validatePasswordStrength(d.password);
  if (pwError) return { error: pwError };

  if (d.role === 'DEALER_USER' && !d.dealerId) {
    return { error: 'Dealer users must be assigned to a dealer.' };
  }

  const email = d.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: 'A user with that email already exists.' };

  const user = await prisma.user.create({
    data: {
      email,
      name: d.name,
      role: d.role,
      dealerId: d.role === 'DEALER_USER' ? d.dealerId! : null,
      passwordHash: await hashPassword(d.password),
    },
  });
  await audit({ actorId: session.userId, action: 'USER_CREATE', entityType: 'User', entityId: user.id, detail: `${email} (${d.role})` });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function toggleUserActiveAction(userId: string): Promise<void> {
  const session = await requireRole('ADMIN');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.id === session.userId) return; // cannot disable self
  await prisma.user.update({ where: { id: userId }, data: { active: !user.active } });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: userId, detail: `active=${!user.active}` });
  revalidatePath('/admin/users');
}

export async function toggleDealerActiveAction(dealerId: string): Promise<void> {
  const session = await requireRole('ADMIN');
  const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
  if (!dealer) return;
  await prisma.dealer.update({ where: { id: dealerId }, data: { active: !dealer.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Dealer', entityId: dealerId, detail: `active=${!dealer.active}` });
  revalidatePath('/admin/dealers');
}

export async function createFinanceCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('ADMIN');
  const parsed = createFinanceCompanySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: 'Enter a finance company name.' };

  const fc = await prisma.financeCompany.create({ data: { name: parsed.data.name } });
  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'FinanceCompany', entityId: fc.id, detail: fc.name });
  revalidatePath('/admin/finance-companies');
  return { ok: true };
}

export async function toggleFinanceCompanyActiveAction(id: string): Promise<void> {
  const session = await requireRole('ADMIN');
  const fc = await prisma.financeCompany.findUnique({ where: { id } });
  if (!fc) return;
  await prisma.financeCompany.update({ where: { id }, data: { active: !fc.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'FinanceCompany', entityId: id, detail: `active=${!fc.active}` });
  revalidatePath('/admin/finance-companies');
}

// --- Announcements / banner ------------------------------------------------

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('ADMIN');
  const file = formData.get('image') as File | null;
  const hasImage = !!file && typeof file !== 'string' && file.size > 0;

  const parsed = announcementSchema.safeParse({
    title: (formData.get('title') as string) || undefined,
    body: (formData.get('body') as string) || undefined,
    linkUrl: (formData.get('linkUrl') as string) || undefined,
    hasImage,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  const created = await prisma.announcement.create({
    data: { title: d.title || null, body: d.body || null, linkUrl: d.linkUrl || null },
  });

  if (hasImage) {
    if (file!.size > MAX_FILE_BYTES) return { error: 'Image is too large (max 15 MB).' };
    if (!ALLOWED_MIME_TYPES.includes(file!.type) || !file!.type.startsWith('image/')) {
      return { error: 'Banner must be an image (JPG, PNG, WEBP).' };
    }
    const ext = path.extname(file!.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || '.img';
    const key = `announcements/${created.id}/${crypto.randomBytes(8).toString('hex')}${ext}`;
    const bytes = Buffer.from(await file!.arrayBuffer());
    await putDocument(key, bytes);
    await prisma.announcement.update({
      where: { id: created.id },
      data: { imageStorageKey: key, imageMime: file!.type },
    });
  }

  await audit({ actorId: session.userId, action: 'DEALER_CREATE', entityType: 'Announcement', entityId: created.id, detail: d.title || 'announcement' });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
  return { ok: true };
}

export async function toggleAnnouncementActiveAction(id: string): Promise<void> {
  const session = await requireRole('ADMIN');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return;
  await prisma.announcement.update({ where: { id }, data: { active: !a.active } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: `active=${!a.active}` });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
}

export async function deleteAnnouncementAction(id: string): Promise<void> {
  const session = await requireRole('ADMIN');
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) return;
  if (a.imageStorageKey) await deleteDocument(a.imageStorageKey).catch(() => {});
  await prisma.announcement.delete({ where: { id } });
  await audit({ actorId: session.userId, action: 'DEALER_UPDATE', entityType: 'Announcement', entityId: id, detail: 'deleted' });
  revalidatePath('/admin/announcements');
  revalidatePath('/dealer');
}
