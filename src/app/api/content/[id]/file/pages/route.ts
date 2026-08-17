import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { renderPdfPagesStacked } from '@/lib/pdfThumb';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// All pages of a content-item PDF (a Resources/guide file) stacked into one
// scrollable webp, so it reads fully inside the app. Same access as the file.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const item = await prisma.contentItem.findUnique({ where: { id: params.id } });
  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!item || (!item.active && !isStaff)) return new NextResponse('Not found', { status: 404 });
  if (!item.fileStorageKey || (item.fileMime || '') !== 'application/pdf') {
    return new NextResponse('Not a PDF', { status: 404 });
  }

  let img: Buffer | null = null;
  try {
    img = await renderPdfPagesStacked(await getDocument(item.fileStorageKey));
  } catch (err) {
    console.error('[content/pages] failed', err);
  }
  if (!img) return new NextResponse('Unavailable', { status: 500 });

  return new NextResponse(new Uint8Array(img), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
