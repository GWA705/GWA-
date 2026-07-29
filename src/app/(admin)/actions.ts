'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { audit } from '@/lib/audit';
import { createUserSchema, createDealerSchema, createFinanceCompanySchema } from '@/lib/validation';

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
