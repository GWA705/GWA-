import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

const COOKIE_NAME = 'gwa_session';
const MFA_COOKIE_NAME = 'gwa_mfa_pending';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  dealerId: string | null;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters.');
  }
  return new TextEncoder().encode(s);
}

async function sign(payload: JWTPayload, ttl: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret());
}

async function verify(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function createSession(user: SessionUser): Promise<void> {
  const token = await sign({ ...user }, SESSION_TTL_SECONDS);
  cookies().set(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
  cookies().delete(MFA_COOKIE_NAME);
}

/** Intermediate state: password verified, awaiting a TOTP code. */
export async function createMfaPending(userId: string): Promise<void> {
  const token = await sign({ userId, mfa: 'pending' }, 60 * 5);
  cookies().set(MFA_COOKIE_NAME, token, { ...cookieOptions, maxAge: 60 * 5 });
}

export async function getMfaPendingUserId(): Promise<string | null> {
  const token = cookies().get(MFA_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || payload.mfa !== 'pending') return null;
  return (payload.userId as string) ?? null;
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || !payload.userId) return null;
  return {
    userId: payload.userId as string,
    email: payload.email as string,
    name: payload.name as string,
    role: payload.role as Role,
    dealerId: (payload.dealerId as string | null) ?? null,
  };
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
  cookies().delete(MFA_COOKIE_NAME);
}

/** Require a logged-in session or redirect to the login page. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/** Require one of the given roles or redirect to a safe landing page. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    redirect(defaultLandingFor(session.role));
  }
  return session;
}

export function defaultLandingFor(role: Role): string {
  switch (role) {
    case 'DEALER_USER':
      return '/dealer';
    case 'REVIEWER':
      return '/staff';
    case 'ADMIN':
      return '/admin';
    default:
      return '/login';
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
