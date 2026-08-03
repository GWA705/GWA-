import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Authenticated, access-controlled mail-attachment download. Every open by a
// dealer user is recorded (first/last view + count) so it's documented who
// viewed the file and when — the whole point of the Mail area.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const asDownload = req.nextUrl.searchParams.get('download') === '1';

  const att = await prisma.mailAttachment.findUnique({
    where: { id: params.id },
    include: { mail: { include: { recipients: { select: { dealerId: true } } } } },
  });
  if (!att) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!isStaff) {
    const visible =
      att.mail.allDealers || att.mail.recipients.some((r) => r.dealerId === session.dealerId);
    if (!visible) return new NextResponse('Forbidden', { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await getDocument(att.storageKey);
  } catch (err) {
    console.error('[mail] attachment retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  // Record the view for dealer users (the audience whose reading we document).
  if (!isStaff) {
    const now = new Date();
    await prisma.mailAttachmentView.upsert({
      where: { attachmentId_userId: { attachmentId: att.id, userId: session.userId } },
      create: { attachmentId: att.id, userId: session.userId, firstViewedAt: now, lastViewedAt: now },
      update: { lastViewedAt: now, viewCount: { increment: 1 } },
    });
    // Opening an attachment also counts as opening the mail.
    await prisma.mailReceipt.upsert({
      where: { mailId_userId: { mailId: att.mailId, userId: session.userId } },
      create: { mailId: att.mailId, userId: session.userId },
      update: {},
    });
  }

  await audit({
    actorId: session.userId,
    action: 'MAIL_ATTACH_VIEW',
    entityType: 'MailAttachment',
    entityId: att.id,
    detail: `mail ${att.mailId}`,
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': att.mimeType || 'application/octet-stream',
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(att.fileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
