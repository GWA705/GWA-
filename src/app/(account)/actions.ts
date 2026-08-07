'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireSession, createSession } from '@/lib/session';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';
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
    notifyAttentionAlerts: formData.get('notifyAttentionAlerts') === 'on',
    notifyIdleReminders: formData.get('notifyIdleReminders') === 'on',
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
      notifyAttentionAlerts: d.notifyAttentionAlerts,
      notifyIdleReminders: d.notifyIdleReminders,
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      tokenVersion: { increment: 1 }, // revoke sessions on other devices
    },
  });
  // Re-issue this device's session at the new version so the user stays signed
  // in here while any other sessions are invalidated.
  await createSession({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    dealerId: session.dealerId,
    superAdmin: session.superAdmin,
    adminSections: session.adminSections,
    tokenVersion: updated.tokenVersion,
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
  const limit = await rateLimit(`mfa-enroll:${session.userId}`, 3, 300);
  if (!limit.ok) return { error: 'Too many code requests. Please wait a few minutes and try again.' };
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

export async function disableMfaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  // Require the current password so a hijacked session can't silently remove 2FA.
  const current = String(formData.get('currentPassword') || '');
  if (!current) return { error: 'Enter your current password to disable 2FA.' };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: 'Account not found.' };
  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) return { error: 'Your current password is incorrect.' };

  await prisma.user.update({
    where: { id: session.userId },
    data: { mfaEnabled: false, mfaMethod: null, mfaSecretEnc: null, mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
  });
  await audit({ actorId: session.userId, action: 'USER_UPDATE', entityType: 'User', entityId: session.userId, detail: 'MFA disabled' });
  revalidatePath('/account');
  return { ok: true };
}

// Mark the welcome tour as seen (called when a dealer finishes or skips it).
export async function completeWelcomeTourAction(): Promise<void> {
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.userId }, data: { tourSeenAt: new Date() } });
}

// Replay the welcome tour — clears the "seen" flag so it shows again next time
// the dealer opens their portal.
export async function replayWelcomeTourAction(): Promise<void> {
  const session = await requireSession();
  await prisma.user.update({ where: { id: session.userId }, data: { tourSeenAt: null } });
  redirect('/dealer');
}

// Acknowledge a must-read pop-up alert (the user pressed X / "I've read this").
// Works for any signed-in user — dealers, reviewers, admins. Idempotent.
export async function acknowledgeAlertAction(alertId: string): Promise<void> {
  const session = await requireSession();
  await prisma.alertAck
    .upsert({
      where: { alertId_userId: { alertId, userId: session.userId } },
      create: { alertId, userId: session.userId },
      update: {},
    })
    .catch(() => {});
  revalidatePath('/dealer');
  revalidatePath('/staff');
  revalidatePath('/admin');
}
