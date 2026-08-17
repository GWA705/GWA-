import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';

// Product image for a marketplace item. Auth-gated (portal users only). Resized
// and cached via the shared image helper; `?size=full` for a larger view.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const item = await prisma.marketplaceItem.findUnique({
    where: { id: params.id },
    select: { imageStorageKey: true, imageMime: true },
  });
  if (!item?.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  const width = req.nextUrl.searchParams.get('size') === 'full' ? 1400 : 640;
  const versioned = req.nextUrl.searchParams.has('v');

  try {
    const bytes = await getDocument(item.imageStorageKey);
    return await resizedImageResponse(bytes, { width, versioned, fallbackMime: item.imageMime });
  } catch (err) {
    console.error('[marketplace] image retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }
}
