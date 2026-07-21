import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Authenticated, access-controlled document download. There are no public URLs
// to document contents; every retrieval is authorized and audited.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { application: true },
  });
  if (!doc) return new NextResponse('Not found', { status: 404 });

  if (!canAccessApplication(session, doc.application.dealerId)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await getDocument(doc.storageKey);
  } catch (err) {
    console.error('[documents] retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'Document',
    entityId: doc.id,
    detail: `application ${doc.applicationId}`,
  });

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
