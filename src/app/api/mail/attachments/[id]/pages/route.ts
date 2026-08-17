import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { renderPdfPagesStacked } from '@/lib/pdfThumb';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// All pages of a mail-attachment PDF stacked into one scrollable webp, so it
// reads fully in the in-portal viewer. Same access rules as the attachment.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const att = await prisma.mailAttachment.findUnique({
    where: { id: params.id },
    include: { mail: { include: { recipients: { select: { dealerId: true } } } } },
  });
  if (!att) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!isStaff) {
    const visible = att.mail.allDealers || att.mail.recipients.some((r) => r.dealerId === session.dealerId);
    if (!visible) return new NextResponse('Forbidden', { status: 403 });
  }
  if (att.mimeType !== 'application/pdf') return new NextResponse('Not a PDF', { status: 404 });

  let img: Buffer | null = null;
  try {
    img = await renderPdfPagesStacked(await getDocument(att.storageKey));
  } catch (err) {
    console.error('[mail/pages] failed', err);
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
