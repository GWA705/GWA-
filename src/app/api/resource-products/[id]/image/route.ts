import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';

// Serves a resource product's photo to any signed-in user. Small (`?size=card`,
// the default) for tiles; larger (`?size=full`) for the lightbox. Resized and
// cached via the shared image helper.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const p = await prisma.resourceProduct.findUnique({
    where: { id: params.id },
    select: { imageStorageKey: true, imageMime: true },
  });
  if (!p || !p.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  const width = req.nextUrl.searchParams.get('size') === 'full' ? 1400 : 640;
  const versioned = req.nextUrl.searchParams.has('v');

  try {
    const bytes = await getDocument(p.imageStorageKey);
    return await resizedImageResponse(bytes, { width, versioned, fallbackMime: p.imageMime });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
