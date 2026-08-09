import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'gwa_session';
const VIEW_AS_COOKIE_NAME = 'gwa_view_as';

function secret(): Uint8Array {
  // Fail closed: with no configured secret, verification will reject every
  // token (there is no valid key to sign with), so requests fall through to the
  // login redirect rather than being admitted.
  return new TextEncoder().encode(process.env.SESSION_SECRET || '');
}

async function readClaims(req: NextRequest): Promise<{ role: string | null; dealerId: string | null }> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { role: null, dealerId: null };
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const role = (payload.role as string) ?? null;
    let dealerId = (payload.dealerId as string | null) ?? null;
    // An admin "viewing as" a dealer carries the target dealer in a separate
    // signed cookie; honor it so the /dealer guard admits them.
    if (role === 'ADMIN') {
      const viewAsToken = req.cookies.get(VIEW_AS_COOKIE_NAME)?.value;
      if (viewAsToken) {
        try {
          const { payload: v } = await jwtVerify(viewAsToken, secret());
          if (v.viewAs && v.by === payload.userId) dealerId = v.viewAs as string;
        } catch {
          /* ignore an invalid view-as cookie */
        }
      }
    }
    return { role, dealerId };
  } catch {
    return { role: null, dealerId: null };
  }
}

function landingFor(role: string | null): string {
  if (role === 'DEALER_USER') return '/dealer';
  if (role === 'REVIEWER') return '/staff';
  if (role === 'ADMIN') return '/admin';
  return '/login';
}

/**
 * Build the Content Security Policy. In production we use a per-request nonce
 * plus 'strict-dynamic' so Next.js's own scripts run while inline injection is
 * still blocked. In development we allow eval/inline for the dev toolchain.
 */
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  // Only widen the policy for Google Maps when the Places key is configured.
  const gmaps = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const gScript = gmaps ? ' https://maps.googleapis.com' : '';
  const gConnect = gmaps ? ' https://maps.googleapis.com' : '';
  const gImg = gmaps ? ' https://maps.gstatic.com https://maps.googleapis.com https://*.googleusercontent.com' : '';

  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${gScript}`
    : `script-src 'self' 'unsafe-eval' 'unsafe-inline'${gScript}`;
  return [
    "default-src 'self'",
    `img-src 'self' data:${gImg}`,
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src 'self'${gConnect}`,
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

function applyStaticHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  // SAMEORIGIN (not DENY) so the in-app document viewer can embed the portal's
  // own PDF endpoints in an iframe; cross-origin framing is still blocked.
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Per-request nonce for the CSP (also handed to Next.js so it nonces its scripts).
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const csp = buildCsp(nonce);

  // Route-group gating.
  const guards: { prefix: string; roles: string[] }[] = [
    { prefix: '/dealer', roles: ['DEALER_USER'] },
    { prefix: '/staff', roles: ['REVIEWER', 'ADMIN'] },
    { prefix: '/admin', roles: ['ADMIN'] },
  ];

  const guard = guards.find((g) => pathname === g.prefix || pathname.startsWith(g.prefix + '/'));
  if (guard) {
    const { role, dealerId } = await readClaims(req);
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      const res = NextResponse.redirect(url);
      res.headers.set('Content-Security-Policy', csp);
      return applyStaticHeaders(res);
    }
    // The dealer portal also admits internal staff (reviewer/admin) who are
    // linked to a dealer — this powers the "one login, switch portals" access.
    const dealerPortalOk =
      guard.prefix === '/dealer' && (role === 'REVIEWER' || role === 'ADMIN') && !!dealerId;
    if (!guard.roles.includes(role) && !dealerPortalOk) {
      const url = req.nextUrl.clone();
      url.pathname = landingFor(role);
      url.search = '';
      const res = NextResponse.redirect(url);
      res.headers.set('Content-Security-Policy', csp);
      return applyStaticHeaders(res);
    }
  }

  // Pass the nonce + CSP to Next via request headers so it applies the nonce to
  // its own <script> tags, and enforce the CSP on the response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return applyStaticHeaders(res);
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
