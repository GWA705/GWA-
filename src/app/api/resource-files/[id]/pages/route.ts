import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { renderPdfPagesStacked } from '@/lib/pdfThumb';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// All pages of a resource-library PDF stacked into one scrollable webp image,
// so it can be read fully inside the app (iOS won't scroll a PDF in an iframe).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const f = await prisma.resourceProductFile.findUnique({ where: { id: params.id } });
  if (!f) return new NextResponse('Not found', { status: 404 });
  if (f.mime !== 'application/pdf') return new NextResponse('Not a PDF', { status: 404 });

  let img: Buffer | null = null;
  try {
    img = await renderPdfPagesStacked(await getDocument(f.storageKey));
  } catch (err) {
    console.error('[resource-files/pages] failed', err);
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
