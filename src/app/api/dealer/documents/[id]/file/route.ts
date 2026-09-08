import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Stream a dealer's business/compliance document. Auth-gated: staff
// (REVIEWER/ADMIN) may download any; a dealer user may download only their own
// dealer's documents.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const doc = await prisma.dealerDocument.findUnique({
    where: { id: params.id },
    select: { dealerId: true, storageKey: true, mimeType: true, fileName: true },
  });
  if (!doc) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  if (!isStaff && session.dealerId !== doc.dealerId) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(doc.storageKey);
  } catch (err) {
    console.error('[dealer-docs] file retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  await audit({ actorId: session.userId, action: 'DOC_DOWNLOAD', entityType: 'DealerDocument', entityId: params.id });

  const fileName = doc.fileName || 'document';
  const inline = doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/');
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
