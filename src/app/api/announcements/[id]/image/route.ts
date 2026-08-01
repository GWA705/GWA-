import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves an announcement banner image to any signed-in user.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const a = await prisma.announcement.findUnique({ where: { id: params.id } });
  if (!a || !a.active || !a.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  try {
    const bytes = await getDocument(a.imageStorageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': a.imageMime || 'image/jpeg',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
