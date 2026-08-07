import { cache } from 'react';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { ADMIN_SECTIONS } from './constants';

const COOKIE_NAME = 'gwa_session';
const MFA_COOKIE_NAME = 'gwa_mfa_pending';
const MFA_ENROLL_COOKIE_NAME = 'gwa_mfa_enroll';
const PWCHANGE_COOKIE_NAME = 'gwa_pwchange_pending';
const VIEW_AS_COOKIE_NAME = 'gwa_view_as';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  dealerId: string | null;
  // Back-end access control (ADMIN only; false/[] for everyone else). superAdmin
  // = full access + can manage others' access; adminSections = the section keys a
  // scoped admin may reach. Read fresh from the DB each request (not the token).
  superAdmin: boolean;
  adminSections: string[];
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
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
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

export async function createSession(user: SessionUser & { tokenVersion?: number }): Promise<void> {
  const { tokenVersion = 0, impersonating: _imp, ...claims } = user;
  const token = await sign({ ...claims, tv: tokenVersion }, SESSION_TTL_SECONDS);
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

/**
 * Intermediate state: password (and any existing MFA) verified, but the account
 * has no second factor and 2FA is required — so enrollment must complete before
 * a full session is issued. Held in its own short-lived signed cookie.
 */
export async function createMfaEnrollPending(userId: string): Promise<void> {
  const token = await sign({ userId, mfaEnroll: 'pending' }, 60 * 15);
  cookies().set(MFA_ENROLL_COOKIE_NAME, token, { ...cookieOptions, maxAge: 60 * 15 });
}

export async function getMfaEnrollPendingUserId(): Promise<string | null> {
  const token = cookies().get(MFA_ENROLL_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || payload.mfaEnroll !== 'pending') return null;
  return (payload.userId as string) ?? null;
}

export async function clearMfaEnrollPending(): Promise<void> {
  cookies().delete(MFA_ENROLL_COOKIE_NAME);
}

// Memoized per request (React cache): a page + its layout + components often all
// call this, and each call otherwise hits the DB — now a cross-region round trip.
// cache() collapses them to a single lookup per request. Safe: the session can't
// change within one request render.
export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || !payload.userId) return null;

  // Authoritative check against the DB so deactivation, role/dealer changes, and
  // password changes revoke existing sessions immediately (rather than trusting
  // stale token claims for up to the token's 8h life). Fresh role/dealer/name
  // are used so an admin edit takes effect on the user's next request.
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.userId as string },
    select: { id: true, email: true, name: true, role: true, dealerId: true, active: true, tokenVersion: true, superAdmin: true, adminSections: true },
  });
  if (!dbUser || !dbUser.active) return null;
  if (((payload.tv as number | undefined) ?? 0) !== dbUser.tokenVersion) return null;

  const user: SessionUser = {
    userId: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    dealerId: dbUser.dealerId,
    // Only admins carry back-end permissions; keep them empty for other roles.
    superAdmin: dbUser.role === 'ADMIN' ? dbUser.superAdmin : false,
    adminSections: dbUser.role === 'ADMIN' ? dbUser.adminSections : [],
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
});

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
  cookies().delete(MFA_ENROLL_COOKIE_NAME);
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
 * The best landing page for an admin, respecting their back-end permissions.
 * Super Admins land on the Overview; a scoped admin lands on the first section
 * they're allowed (in ADMIN_SECTIONS order). An admin with no sections at all
 * falls back to their account page.
 */
export function adminLandingFor(user: SessionUser): string {
  if (user.role !== 'ADMIN') return defaultLandingFor(user.role);
  if (user.superAdmin) return '/admin';
  const first = ADMIN_SECTIONS.find((s) => user.adminSections.includes(s.key));
  return first ? first.href : '/account';
}

/**
 * Require that the current user is an admin allowed to reach `sectionKey` (a key
 * from ADMIN_SECTIONS). Super Admins pass every check; a scoped admin passes
 * only for sections in their list. Anyone else is redirected to a page they can
 * actually reach. Call this at the top of every back-end page/action.
 */
export async function requireAdminSection(sectionKey: string): Promise<SessionUser> {
  const session = await requireSession();
  const allowed =
    session.role === 'ADMIN' && (session.superAdmin || session.adminSections.includes(sectionKey));
  if (!allowed) {
    redirect(session.role === 'ADMIN' ? adminLandingFor(session) : defaultLandingFor(session.role));
  }
  return session;
}

/**
 * Guard a shared staff-area page (Mail, the Deals queue) that both reviewers and
 * admins use. Reviewers always have full staff access; an admin passes only when
 * they hold the matching back-end section ('mail' or 'review-queue'). This lets a
 * scoped admin be given, say, Mail without the deal queue.
 */
export async function requireStaffSection(sectionKey: string): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role === 'REVIEWER') return session;
  if (session.role === 'ADMIN') {
    if (session.superAdmin || session.adminSections.includes(sectionKey)) return session;
    redirect(adminLandingFor(session));
  }
  redirect(defaultLandingFor(session.role));
}

/** Require the current user to be a Super Admin (manage other admins' access). */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireSession();
  if (session.role !== 'ADMIN' || !session.superAdmin) {
    redirect(session.role === 'ADMIN' ? adminLandingFor(session) : defaultLandingFor(session.role));
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
