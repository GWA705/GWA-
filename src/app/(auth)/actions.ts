'use server';

import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, validatePasswordStrength, isPasswordExpired } from '@/lib/password';
import { verifyMfaToken, decryptMfaSecret } from '@/lib/mfa';
import {
  createSession,
  createMfaPending,
  getMfaPendingUserId,
  createPasswordChangePending,
  getPasswordChangePendingUserId,
  destroySession,
  getSession,
  defaultLandingFor,
} from '@/lib/session';
import { audit } from '@/lib/audit';
import { generateResetToken, hashResetToken, PASSWORD_RESET_TTL_MINUTES } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';
import { renderEmail } from '@/lib/email-templates';
import { loginSchema, mfaSchema } from '@/lib/validation';

export interface FormState {
  error?: string;
  ok?: boolean;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/**
 * Issue a session once identity is fully verified — unless the password has
 * expired, in which case route the user through a forced password change first.
 */
async function finishLogin(user: User, viaMfa: boolean): Promise<never> {
  if (isPasswordExpired(user.passwordChangedAt)) {
    await createPasswordChangePending(user.id);
    redirect('/change-password');
  }
  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
  });
  await audit({
    actorId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
    detail: viaMfa ? 'mfa' : undefined,
  });
  redirect(defaultLandingFor(user.role));
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'Enter a valid email and password.' };

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email }, include: { dealer: true } });

  // Generic error message to avoid user enumeration.
  const genericFail: FormState = { error: 'Invalid credentials.' };

  if (!user || !user.active) {
    await audit({ action: 'LOGIN_FAILED', entityType: 'User', detail: `unknown or inactive: ${email}` });
    return genericFail;
  }

  // A dealer user whose dealership has been archived cannot sign in.
  if (user.dealer && !user.dealer.active) {
    await audit({ actorId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, detail: 'dealer archived' });
    return genericFail;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: 'Account temporarily locked. Try again later.' };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil:
          failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await audit({ actorId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id });
    return genericFail;
  }

  // Password correct — reset counters.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  if (user.mfaEnabled) {
    await createMfaPending(user.id);
    redirect('/mfa');
  }

  return finishLogin(user, false);
}

export async function verifyMfaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await getMfaPendingUserId();
  if (!userId) redirect('/login');

  const parsed = mfaSchema.safeParse({ token: formData.get('token') });
  if (!parsed.success) return { error: 'Enter the 6-digit code.' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || !user.mfaSecretEnc) redirect('/login');

  const secret = decryptMfaSecret(user.mfaSecretEnc);
  if (!verifyMfaToken(parsed.data.token, secret)) {
    await audit({ actorId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, detail: 'bad MFA code' });
    return { error: 'Invalid code. Try again.' };
  }

  return finishLogin(user, true);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await audit({ actorId: session.userId, action: 'LOGOUT', entityType: 'User', entityId: session.userId });
  }
  await destroySession();
  redirect('/login');
}

// --- Forgot / reset password ----------------------------------------------

/**
 * Start a self-service reset. Always returns the same success message
 * regardless of whether the email exists (no account enumeration). When email
 * is in log-only mode the link is written to the server log.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get('email') || '').toLowerCase().trim();
  const generic: FormState = { ok: true };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.active) {
    // Invalidate any outstanding tokens, then mint a fresh one.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const { token, tokenHash } = generateResetToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    });
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    const link = `${base}/reset-password?token=${token}`;
    await sendEmail({
      to: user.notificationEmail || user.email,
      subject: 'Reset your GWA Dealer Portal password',
      html: renderEmail({
        heading: 'Reset your password',
        intro: 'We received a request to reset your password. This link expires in 60 minutes and can be used once.',
        ctaLabel: 'Set a new password',
        ctaUrl: link,
        footerNote: "If you didn't request this, you can safely ignore this email — your password will not change.",
      }),
    });
    await audit({ actorId: user.id, action: 'PASSWORD_RESET_REQUEST', entityType: 'User', entityId: user.id });
  } else {
    await audit({ action: 'PASSWORD_RESET_REQUEST', entityType: 'User', detail: `no active account: ${email}` });
  }

  return generic;
}

/** Complete a reset using the emailed token. */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (!token) return { error: 'This reset link is invalid. Request a new one.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };
  const pwError = validatePasswordStrength(password);
  if (pwError) return { error: pwError };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date() || !record.user.active) {
    return { error: 'This reset link is invalid or has expired. Request a new one.' };
  }

  const same = await verifyPassword(password, record.user.passwordHash);
  if (same) return { error: 'Choose a password you have not used before.' };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Any other outstanding tokens for this user are now void.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);
  await audit({ actorId: record.userId, action: 'PASSWORD_RESET', entityType: 'User', entityId: record.userId });

  return { ok: true };
}

/**
 * Forced change when a password has expired at login. Identity was already
 * proven (password + any MFA) via the password-change-pending cookie; the user
 * just needs to set a new password before a session is issued.
 */
export async function forcedChangePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await getPasswordChangePendingUserId();
  if (!userId) redirect('/login');

  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  if (password !== confirm) return { error: 'Passwords do not match.' };
  const pwError = validatePasswordStrength(password);
  if (pwError) return { error: pwError };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) redirect('/login');

  const same = await verifyPassword(password, user.passwordHash);
  if (same) return { error: 'Choose a password different from your previous one.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
  });
  await audit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id, detail: 'expired-rotation' });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
  });
  redirect(defaultLandingFor(user.role));
}
