import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { thumbnailImage } from '@/lib/image';

// Small inline preview for image attachments. Deliberately does NOT record a
// view — a thumbnail shown in the message list is a preview, not the dealer
// opening the file; the full viewer/download route is what logs an open. Access
// is still authorized exactly like the main attachment route.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const att = await prisma.mailAttachment.findUnique({
    where: { id: params.id },
    include: { mail: { include: { recipients: { select: { dealerId: true } } } } },
  });
  if (!att) return new NextResponse('Not found', { status: 404 });
  if (!att.mimeType.startsWith('image/')) return new NextResponse('No preview', { status: 415 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!isStaff) {
    const visible = att.mail.allDealers || att.mail.recipients.some((r) => r.dealerId === session.dealerId);
    if (!visible) return new NextResponse('Forbidden', { status: 403 });
  }

  let thumb: Buffer;
  try {
    const bytes = await getDocument(att.storageKey);
    thumb = await thumbnailImage(bytes);
  } catch (err) {
    console.error('[mail] thumbnail failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  return new NextResponse(new Uint8Array(thumb), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
