import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves the first-page PDF preview thumbnail for a resource file (webp) to any
// signed-in user. 404 when the file has no generated thumbnail.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const f = await prisma.resourceProductFile.findUnique({
    where: { id: params.id },
    select: { thumbStorageKey: true, thumbMime: true },
  });
  if (!f?.thumbStorageKey) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await getDocument(f.thumbStorageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': f.thumbMime || 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
