import { NextResponse, type NextRequest } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { pdfFirstPageThumb } from '@/lib/pdfThumb';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * A small preview thumbnail (webp) of a deal document, so the reviewer checklist
 * can show what each upload is. Images are downscaled; PDFs have their first page
 * rasterized. Access-controlled the same way as the full document. 404 for file
 * types we can't preview (the UI falls back to a document icon). Rendered
 * on demand and cached by the browser.
 */
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

  const mime = doc.mimeType || '';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  if (!isImage && !isPdf) return new NextResponse('No preview', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(doc.storageKey);
  } catch (err) {
    console.error('[documents/thumb] retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  let thumb: Buffer | null = null;
  try {
    if (isImage) {
      thumb = await sharp(bytes)
        .rotate() // respect EXIF orientation
        .resize({ width: 360, height: 480, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer();
    } else {
      thumb = await pdfFirstPageThumb(bytes);
    }
  } catch (err) {
    console.error('[documents/thumb] render failed', err);
  }
  if (!thumb) return new NextResponse('No preview', { status: 404 });

  return new NextResponse(new Uint8Array(thumb), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
