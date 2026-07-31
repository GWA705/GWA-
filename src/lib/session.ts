import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

const COOKIE_NAME = 'gwa_session';
const MFA_COOKIE_NAME = 'gwa_mfa_pending';
const PWCHANGE_COOKIE_NAME = 'gwa_pwchange_pending';
const VIEW_AS_COOKIE_NAME = 'gwa_view_as';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  dealerId: string | null;
  // True when an admin is currently "viewing as" a dealer. When set, dealerId is
  // the impersonated dealer's id (so all dealer-portal scoping just works).
  impersonating?: boolean;
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
  cookies().delete(PWCHANGE_COOKIE_NAME);
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

/**
 * Intermediate state: identity verified (password + any MFA) but the password
 * has expired, so a new one must be set before a full session is issued.
 */
export async function createPasswordChangePending(userId: string): Promise<void> {
  const token = await sign({ userId, pwchange: 'pending' }, 60 * 10);
  cookies().set(PWCHANGE_COOKIE_NAME, token, { ...cookieOptions, maxAge: 60 * 10 });
}

export async function getPasswordChangePendingUserId(): Promise<string | null> {
  const token = cookies().get(PWCHANGE_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || payload.pwchange !== 'pending') return null;
  return (payload.userId as string) ?? null;
}

export async function clearPasswordChangePending(): Promise<void> {
  cookies().delete(PWCHANGE_COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || !payload.userId) return null;
  const user: SessionUser = {
    userId: payload.userId as string,
    email: payload.email as string,
    name: payload.name as string,
    role: payload.role as Role,
    dealerId: (payload.dealerId as string | null) ?? null,
  };

  // "View as dealer": only an admin can impersonate, and only their own cookie
  // counts (by === their userId). When active, the effective dealerId becomes
  // the impersonated dealer so the dealer portal scopes to it automatically.
  if (user.role === 'ADMIN') {
    const viewAs = await getViewAs();
    if (viewAs && viewAs.by === user.userId) {
      user.dealerId = viewAs.dealerId;
      user.impersonating = true;
    }
  }
  return user;
}

/** Start "view as dealer" for an admin. Signed + bound to the admin's userId. */
export async function startViewAs(dealerId: string, adminUserId: string): Promise<void> {
  const token = await sign({ viewAs: dealerId, by: adminUserId }, SESSION_TTL_SECONDS);
  cookies().set(VIEW_AS_COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS });
}

/** Stop impersonating. */
export function stopViewAs(): void {
  cookies().delete(VIEW_AS_COOKIE_NAME);
}

async function getViewAs(): Promise<{ dealerId: string; by: string } | null> {
  const token = cookies().get(VIEW_AS_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || !payload.viewAs || !payload.by) return null;
  return { dealerId: payload.viewAs as string, by: payload.by as string };
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE_NAME);
  cookies().delete(MFA_COOKIE_NAME);
  cookies().delete(PWCHANGE_COOKIE_NAME);
  cookies().delete(VIEW_AS_COOKIE_NAME);
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

/**
 * Can this user act in the dealer portal? Dealer users always can (their tenant
 * is their dealerId). Internal staff (reviewer/admin) can too, but only if they
 * have been linked to a dealer — this powers the "one login, switch portals"
 * dual access.
 */
export function hasDealerAccess(user: SessionUser): boolean {
  if (user.role === 'DEALER_USER') return true;
  return (user.role === 'REVIEWER' || user.role === 'ADMIN') && !!user.dealerId;
}

/** True when the user can use BOTH the dealer and the staff/reviewer portals. */
export function hasBothPortals(user: SessionUser): boolean {
  const staff = user.role === 'REVIEWER' || user.role === 'ADMIN';
  return staff && !!user.dealerId;
}

/** Require dealer-portal access (dealer user, or internal user linked to a dealer). */
export async function requireDealerAccess(): Promise<SessionUser> {
  const session = await requireSession();
  if (!hasDealerAccess(session)) {
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
