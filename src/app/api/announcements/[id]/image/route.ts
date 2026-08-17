import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';

// Serves an announcement banner image to any signed-in user. Banners run
// full-width, so keep a larger max width; resized and cached via the shared
// image helper.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const a = await prisma.announcement.findUnique({ where: { id: params.id } });
  if (!a || !a.active || !a.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  const versioned = req.nextUrl.searchParams.has('v');

  try {
    const bytes = await getDocument(a.imageStorageKey);
    return await resizedImageResponse(bytes, { width: 1600, versioned, fallbackMime: a.imageMime });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
