import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getDocument } from '@/lib/storage';
import { readDocLinkToken } from '@/lib/docLink';

export const dynamic = 'force-dynamic';

// Public (unauthenticated) download of a Product Library file via a secure,
// expiring token minted in docLink.ts. Used for manuals/brochures too large to
// attach to a customer email. The token is encrypted + time-limited, so only a
// link we generated works, and only until it expires. These are non-sensitive
// marketing documents; no personal data is ever served here.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = readDocLinkToken(decodeURIComponent(params.token));
  if (!parsed) {
    return new NextResponse('This download link is invalid or has expired. Please contact us for a new one.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const file = await prisma.resourceProductFile.findFirst({
    where: { id: parsed.fileId, product: { active: true } },
    select: { storageKey: true, mime: true, originalName: true, product: { select: { title: true } } },
  });
  if (!file) {
    return new NextResponse('This document is no longer available.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  let bytes: Buffer;
  try {
    bytes = await getDocument(file.storageKey);
  } catch (err) {
    console.error('[doc-link] retrieval failed', err);
    return new NextResponse('Could not read this document right now. Please try again later.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const name = (file.originalName || `${file.product.title}.pdf`).replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim();
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
