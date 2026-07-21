'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { verifyMfaToken, decryptMfaSecret } from '@/lib/mfa';
import {
  createSession,
  createMfaPending,
  getMfaPendingUserId,
  destroySession,
  getSession,
  defaultLandingFor,
} from '@/lib/session';
import { audit } from '@/lib/audit';
import { loginSchema, mfaSchema } from '@/lib/validation';

export interface FormState {
  error?: string;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

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
  const user = await prisma.user.findUnique({ where: { email } });

  // Generic error message to avoid user enumeration.
  const genericFail: FormState = { error: 'Invalid credentials.' };

  if (!user || !user.active) {
    await audit({ action: 'LOGIN_FAILED', entityType: 'User', detail: `unknown or inactive: ${email}` });
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

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
  });
  await audit({ actorId: user.id, action: 'LOGIN_SUCCESS', entityType: 'User', entityId: user.id });
  redirect(defaultLandingFor(user.role));
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

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    dealerId: user.dealerId,
  });
  await audit({ actorId: user.id, action: 'LOGIN_SUCCESS', entityType: 'User', entityId: user.id, detail: 'mfa' });
  redirect(defaultLandingFor(user.role));
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await audit({ actorId: session.userId, action: 'LOGOUT', entityType: 'User', entityId: session.userId });
  }
  await destroySession();
  redirect('/login');
}
