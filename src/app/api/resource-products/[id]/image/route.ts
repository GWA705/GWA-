import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves a resource product's photo to any signed-in user.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const p = await prisma.resourceProduct.findUnique({
    where: { id: params.id },
    select: { imageStorageKey: true, imageMime: true },
  });
  if (!p || !p.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await getDocument(p.imageStorageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': p.imageMime || 'image/jpeg',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
