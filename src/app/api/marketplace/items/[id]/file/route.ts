import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Downloadable file attached to a marketplace item (e.g. print-ready signage).
// Auth-gated: any portal user may download an active item's file; staff may
// download regardless of active state (for previewing hidden items).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const item = await prisma.marketplaceItem.findUnique({
    where: { id: params.id },
    select: { active: true, fileStorageKey: true, fileMime: true, fileName: true },
  });
  if (!item?.fileStorageKey) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!item.active && !isStaff) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(item.fileStorageKey);
  } catch (err) {
    console.error('[marketplace] file retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  await audit({
    actorId: session.userId,
    action: 'MARKETPLACE_FILE_DOWNLOAD',
    entityType: 'MarketplaceItem',
    entityId: params.id,
  });

  const fileName = item.fileName || 'download';
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': item.fileMime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
