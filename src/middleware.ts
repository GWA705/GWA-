import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'gwa_session';

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET || '');
}

async function readRole(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.role as string) ?? null;
  } catch {
    return null;
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
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

function applyStaticHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
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
    const role = await readRole(req);
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      const res = NextResponse.redirect(url);
      res.headers.set('Content-Security-Policy', csp);
      return applyStaticHeaders(res);
    }
    if (!guard.roles.includes(role)) {
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
