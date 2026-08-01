import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Serves a content-item attachment (resource / promotion / guide file) to any
// signed-in user. Files are encrypted at rest and never exposed via a public URL.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  if (!item || !item.active) return new NextResponse('Not found', { status: 404 });

  // ?thumb=1 serves the optional custom cover image instead of the attachment.
  const wantThumb = req.nextUrl.searchParams.get('thumb') === '1';
  const key = wantThumb ? item.thumbStorageKey : item.fileStorageKey;
  const mime = wantThumb ? item.thumbMime : item.fileMime;
  if (!key) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(key);
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }

  // A thumbnail is just a preview image — serve it inline without an audit entry.
  if (wantThumb) {
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mime || 'image/jpeg',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const download = req.nextUrl.searchParams.get('download') === '1';
  const disposition = download ? 'attachment' : 'inline';
  const name = item.fileName || 'file';

  await audit({ actorId: session.userId, action: 'DOC_DOWNLOAD', entityType: 'ContentItem', entityId: item.id });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': item.fileMime || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
