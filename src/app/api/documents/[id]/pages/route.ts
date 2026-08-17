import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { renderPdfPagesStacked } from '@/lib/pdfThumb';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// All pages of a deal-document PDF stacked into one scrollable webp image, so it
// can be read fully inside the app. Access-controlled like the document itself.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { application: { select: { dealerId: true } } },
  });
  if (!doc) return new NextResponse('Not found', { status: 404 });
  if (!canAccessApplication(session, doc.application.dealerId)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  if (doc.mimeType !== 'application/pdf') return new NextResponse('Not a PDF', { status: 404 });

  let img: Buffer | null = null;
  try {
    img = await renderPdfPagesStacked(await getDocument(doc.storageKey));
  } catch (err) {
    console.error('[documents/pages] failed', err);
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
