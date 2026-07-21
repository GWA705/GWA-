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

function applySecurityHeaders(res: NextResponse): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';
  // Content Security Policy. 'unsafe-inline' for styles supports Tailwind's
  // injected styles and inline data-URL QR codes; scripts are same-origin.
  const csp = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'" + (isProd ? '' : " 'unsafe-eval'"),
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProd) {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
      return applySecurityHeaders(NextResponse.redirect(url));
    }
    if (!guard.roles.includes(role)) {
      const url = req.nextUrl.clone();
      url.pathname = landingFor(role);
      url.search = '';
      return applySecurityHeaders(NextResponse.redirect(url));
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
