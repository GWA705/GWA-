'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword, validatePasswordStrength, isPasswordExpired } from '@/lib/password';
import {
  generateMfaSecret,
  encryptMfaSecret,
  verifyMfaToken,
  decryptMfaSecret,
  emailCodeMatches,
} from '@/lib/mfa';
import { issueEmailMfaCode } from '@/lib/mfa-email';
import { emailEnabled } from '@/lib/email';
import { getMfaRequirement, mfaRequiredForRole } from '@/lib/settings';
import {
  createSession,
  createMfaPending,
  getMfaPendingUserId,
  createMfaEnrollPending,
  getMfaEnrollPendingUserId,
  clearMfaEnrollPending,
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
import { rateLimit, clientIp } from '@/lib/ratelimit';

export interface FormState {
  error?: string;
  ok?: boolean;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

// A valid bcrypt hash used to equalize response time on the "no such user" path
// so login timing can't be used to enumerate valid emails. It matches nothing.
const DUMMY_HASH = '$2a$12$5WCWaDYMRsQgrkaWIpoLbO1SUDrb6/mLFAkBULwro1FQAMe6gjYt2';
const TOO_MANY: FormState = { error: 'Too many attempts. Please wait a few minutes and try again.' };

/**
 * Issue a session once identity is fully verified — unless the password has
 * expired, in which case route the user through a forced password change first.
 */
async function finishLogin(user: User, viaMfa: boolean): Promise<never> {
  // Identity fully proven — clear any failed-attempt lockout (covers the MFA
  // success path too).
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
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
    isDistributor: user.isDistributor,
    superAdmin: user.superAdmin,
    adminSections: user.adminSections,
    tokenVersion: user.tokenVersion,
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

  // Per-IP and per-email throttle to blunt credential stuffing / brute force,
  // on top of the per-account lockout below.
  const ip = clientIp();
  const ipLimit = await rateLimit(`login:ip:${ip}`, 30, 600);
  const emailLimit = await rateLimit(`login:email:${email}`, 10, 600);
  if (!ipLimit.ok || !emailLimit.ok) return TOO_MANY;

  const user = await prisma.user.findUnique({ where: { email }, include: { dealer: true } });

  // Generic error message to avoid user enumeration.
  const genericFail: FormState = { error: 'Invalid credentials.' };

  if (!user || !user.active) {
    // Run a dummy bcrypt compare so the no-user path takes the same time as a
    // real one (prevents timing-based email enumeration).
    await verifyPassword(parsed.data.password, DUMMY_HASH);
    await audit({ action: 'LOGIN_FAILED', entityType: 'User', detail: `unknown or inactive: ${email}` });
    return genericFail;
  }

  // A dealer user whose dealership has been archived cannot sign in. Internal
  // staff linked to an archived dealer can still sign in (they keep staff access
  // and simply lose the dealer view).
  if (user.role === 'DEALER_USER' && user.dealer && !user.dealer.active) {
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
    // Email method: send a one-time code now; app method: prompt for the app code.
    if (user.mfaMethod === 'EMAIL') {
      await issueEmailMfaCode(user);
    }
    await createMfaPending(user.id);
    redirect('/mfa');
  }

  // No second factor yet — if the policy requires 2FA for this user, force
  // enrollment before a full session is issued.
  const requirement = await getMfaRequirement();
  if (mfaRequiredForRole(user.role, requirement)) {
    await createMfaEnrollPending(user.id);
    redirect('/setup-2fa');
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
  if (!user || !user.mfaEnabled) redirect('/login');

  // The second factor is now brute-force protected: the same per-account lockout
  // as the password step, plus a per-IP throttle.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: 'Too many attempts. Your account is temporarily locked — try again later.' };
  }
  const ipLimit = await rateLimit(`mfa:ip:${clientIp()}`, 30, 600);
  if (!ipLimit.ok) return TOO_MANY;

  // Record a failed second-factor attempt: increment the shared failure counter,
  // lock after the threshold, and (for the email method) invalidate the code so
  // it can't be guessed further within its TTL.
  const registerMfaFailure = async (detail: string, invalidateEmailCode: boolean) => {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : user.lockedUntil,
        ...(invalidateEmailCode ? { mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null } : {}),
      },
    });
    await audit({ actorId: user.id, action: 'LOGIN_FAILED', entityType: 'User', entityId: user.id, detail });
  };

  if (user.mfaMethod === 'EMAIL') {
    if (!emailCodeMatches(parsed.data.token, user.mfaEmailCodeHash, user.mfaEmailCodeExpiresAt)) {
      await registerMfaFailure('bad email MFA code', true);
      return { error: 'Invalid or expired code. Resend a new code and try again.' };
    }
    // Consume the code so it can't be reused.
    await prisma.user.update({ where: { id: user.id }, data: { mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null } });
    return finishLogin(user, true);
  }

  if (!user.mfaSecretEnc) redirect('/login');
  const secret = decryptMfaSecret(user.mfaSecretEnc);
  if (!verifyMfaToken(parsed.data.token, secret)) {
    await registerMfaFailure('bad MFA code', false);
    return { error: 'Invalid code. Try again.' };
  }

  return finishLogin(user, true);
}

// Resend the email 2FA code from the /mfa page (EMAIL method only).
export async function resendMfaEmailAction(): Promise<FormState> {
  const userId = await getMfaPendingUserId();
  if (!userId) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaEnabled || user.mfaMethod !== 'EMAIL') redirect('/login');
  // Cap resends so the email code can't be endlessly refreshed to extend a
  // brute-force window (and to avoid inbox/SMTP abuse).
  const limit = await rateLimit(`mfa-resend:${userId}`, 3, 300);
  if (!limit.ok) return TOO_MANY;
  await issueEmailMfaCode(user);
  return { ok: true };
}

// --- Forced 2FA enrollment (mandatory-MFA gate) ---------------------------
// Reached only via the enroll-pending cookie set at login when the account has
// no second factor and the policy requires one. On success a full session is
// issued (finishLogin), so there is no way to bypass 2FA to reach the app.

async function requireEnrollUser() {
  const userId = await getMfaEnrollPendingUserId();
  if (!userId) redirect('/login');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) redirect('/login');
  return user;
}

/** Email the one-time setup code (EMAIL method). */
export async function setupMfaSendEmailAction(): Promise<FormState> {
  const user = await requireEnrollUser();
  const limit = await rateLimit(`mfa-setup-email:${user.id}`, 4, 300);
  if (!limit.ok) return TOO_MANY;
  if (!emailEnabled()) {
    return { error: 'Email is not available right now — use an authenticator app instead.' };
  }
  await issueEmailMfaCode(user);
  return { ok: true };
}

/** Confirm the emailed code and finish enrollment via the EMAIL method. */
export async function setupMfaConfirmEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEnrollUser();
  const ipLimit = await rateLimit(`mfa-setup:ip:${clientIp()}`, 30, 600);
  if (!ipLimit.ok) return TOO_MANY;
  const code = String(formData.get('token') || '');
  if (!emailCodeMatches(code, user.mfaEmailCodeHash, user.mfaEmailCodeExpiresAt)) {
    return { error: 'Invalid or expired code. Send a new code and try again.' };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaMethod: 'EMAIL', mfaSecretEnc: null, mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
  });
  await audit({ actorId: user.id, action: 'MFA_ENROLLED', entityType: 'User', entityId: user.id, detail: 'email (required)' });
  await clearMfaEnrollPending();
  return finishLogin(user, true);
}

/** Generate + store a pending authenticator secret so the page can show a QR. */
export async function setupMfaBeginAppAction(): Promise<FormState> {
  const user = await requireEnrollUser();
  const secret = generateMfaSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encryptMfaSecret(secret), mfaEnabled: false } });
  revalidatePath('/setup-2fa');
  return { ok: true };
}

/** Confirm the authenticator code and finish enrollment via the APP method. */
export async function setupMfaConfirmAppAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEnrollUser();
  const ipLimit = await rateLimit(`mfa-setup:ip:${clientIp()}`, 30, 600);
  if (!ipLimit.ok) return TOO_MANY;
  if (!user.mfaSecretEnc) return { error: 'Start the authenticator setup first.' };
  const token = String(formData.get('token') || '');
  const secret = decryptMfaSecret(user.mfaSecretEnc);
  if (!verifyMfaToken(token, secret)) return { error: 'Invalid code. Try again.' };
  await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaMethod: 'APP' } });
  await audit({ actorId: user.id, action: 'MFA_ENROLLED', entityType: 'User', entityId: user.id, detail: 'app (required)' });
  await clearMfaEnrollPending();
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

  // Throttle reset requests per IP and per email so a victim's inbox / SMTP
  // quota can't be flooded. On block, return the same generic success (no
  // enumeration, no info about whether an email was actually sent).
  const ipLimit = await rateLimit(`pwreset:ip:${clientIp()}`, 10, 3600);
  const emailLimit = await rateLimit(`pwreset:email:${email}`, 3, 3600);
  if (!ipLimit.ok || !emailLimit.ok) return generic;

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
        tokenVersion: { increment: 1 }, // revoke any existing sessions
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

  const rotated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      tokenVersion: { increment: 1 }, // revoke any other existing sessions
    },
  });
  await audit({ actorId: user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: user.id, detail: 'expired-rotation' });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
    isDistributor: user.isDistributor,
    superAdmin: user.superAdmin,
    adminSections: user.adminSections,
    tokenVersion: rotated.tokenVersion,
  });
  redirect(defaultLandingFor(user.role));
}
