'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/password';
import {
  generateMfaSecret,
  encryptMfaSecret,
  decryptMfaSecret,
  verifyMfaToken,
  emailCodeMatches,
} from '@/lib/mfa';
import { issueEmailMfaCode } from '@/lib/mfa-email';
import { emailEnabled } from '@/lib/email';

import { profileSchema } from '@/lib/validation';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    notificationEmail: formData.get('notificationEmail') || undefined,
    notifyStatusUpdates: formData.get('notifyStatusUpdates') === 'on',
    notifyNewNotes: formData.get('notifyNewNotes') === 'on',
    notifyNewDocuments: formData.get('notifyNewDocuments') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const d = parsed.data;

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: d.name,
      phone: d.phone || null,
      notificationEmail: d.notificationEmail || null,
      notifyStatusUpdates: d.notifyStatusUpdates,
      notifyNewNotes: d.notifyNewNotes,
      notifyNewDocuments: d.notifyNewDocuments,
    },
  });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: session.userId, detail: 'Profile updated' });
  revalidatePath('/account');
  return { ok: true };
}

/** Self-service password change for a signed-in user (requires current password). */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const current = String(formData.get('currentPassword') || '');
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (!current) return { error: 'Enter your current password.' };
  if (password !== confirm) return { error: 'New passwords do not match.' };
  const pwError = validatePasswordStrength(password);
  if (pwError) return { error: pwError };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: 'Account not found.' };

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return { error: 'Your current password is incorrect.' };

  const same = await verifyPassword(password, user.passwordHash);
  if (same) return { error: 'Choose a password different from your current one.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
  });
  await audit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id });
  return { ok: true };
}

/** Generate a fresh TOTP secret and store it as "pending" (mfaEnabled=false). */
export async function beginMfaAction(): Promise<void> {
  const session = await requireSession();
  const secret = generateMfaSecret();
  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaSecretEnc: encryptMfaSecret(secret), mfaEnabled: false },
  });
  revalidatePath('/account');
}

export async function confirmMfaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.mfaSecretEnc) return { error: 'Start enrollment first.' };

  const token = String(formData.get('token') || '');
  const secret = decryptMfaSecret(user.mfaSecretEnc);
  if (!verifyMfaToken(token, secret)) return { error: 'Invalid code. Try again.' };

  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaMethod: 'APP' } });
  await audit({ actorId: user.id, action: 'MFA_ENROLLED', entityType: 'User', entityId: user.id, detail: 'app' });
  revalidatePath('/account');
  return { ok: true };
}

/** Start email-code 2FA enrollment: email a code the user confirms below. */
export async function beginEmailMfaAction(): Promise<ActionState> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: 'Not found.' };
  if (!emailEnabled()) {
    return { error: 'Email is not configured yet, so email codes cannot be used. Set up email first (admin → Email), or use an authenticator app.' };
  }
  const { sent } = await issueEmailMfaCode(user);
  revalidatePath('/account');
  if (!sent) return { error: 'Could not send the code email. Check the email settings and try again.' };
  return { ok: true };
}

export async function confirmEmailMfaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: 'Not found.' };

  const code = String(formData.get('token') || '');
  if (!emailCodeMatches(code, user.mfaEmailCodeHash, user.mfaEmailCodeExpiresAt)) {
    return { error: 'Invalid or expired code. Send a new code and try again.' };
  }
  await prisma.user.update({
    where: { id: user.id },
    // Switching to email 2FA — clear any app secret so only one method is active.
    data: { mfaEnabled: true, mfaMethod: 'EMAIL', mfaSecretEnc: null, mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
  });
  await audit({ actorId: user.id, action: 'MFA_ENROLLED', entityType: 'User', entityId: user.id, detail: 'email' });
  revalidatePath('/account');
  return { ok: true };
}

export async function disableMfaAction(): Promise<void> {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaEnabled: false, mfaMethod: null, mfaSecretEnc: null, mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
  });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: session.userId, detail: 'MFA disabled' });
  revalidatePath('/account');
}
