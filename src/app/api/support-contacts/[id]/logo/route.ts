import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves a support-contact logo to any signed-in user (shown on the dealer
// Contact / Support page and the admin management screen).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const c = await prisma.supportContact.findUnique({ where: { id: params.id } });
  if (!c || !c.logoStorageKey) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await getDocument(c.logoStorageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': c.logoMime || 'image/png',
        'X-Content-Type-Options': 'nosniff',
        // Version-stamped URL (?v=updatedAt) → safe to cache hard. Loads instantly
        // after the first hit instead of re-fetching from S3 every few minutes.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
