import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves an office logo to any signed-in user (shown in the directory + on the
// dealer's own profile / contact card).
export async function GET(_req: NextRequest, { params }: { params: { dealerId: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const p = await prisma.dealerProfile.findUnique({ where: { dealerId: params.dealerId } });
  if (!p || !p.logoStorageKey) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await getDocument(p.logoStorageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': p.logoMime || 'image/png',
        'X-Content-Type-Options': 'nosniff',
        // The URL is version-stamped (?v=updatedAt), so a given URL never changes
        // its bytes — cache it hard so the logo loads instantly after the first
        // hit instead of re-fetching from S3 every few minutes.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
