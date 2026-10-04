import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

// Serves a login-screen background. This one is PUBLIC (the sign-in page is shown
// before auth), so it's rate-limited per IP to bound a scripted burst against the
// single instance, and it only ever serves an active LoginTheme row's image — no
// arbitrary storage keys. Resized + cached via the shared helper, which serves
// GIFs untouched so an animated occasion background keeps moving.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const rl = await rateLimit(`login-theme-img:${ip}`, 60, 60);
  if (!rl.ok) {
    return new NextResponse('Too many requests — please wait a moment.', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const t = await prisma.loginTheme.findUnique({ where: { id: params.id } });
  if (!t || !t.active) return new NextResponse('Not found', { status: 404 });

  const versioned = req.nextUrl.searchParams.has('v');
  try {
    const bytes = await getDocument(t.imageStorageKey);
    return await resizedImageResponse(bytes, { width: 1920, versioned, fallbackMime: t.imageMime });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
