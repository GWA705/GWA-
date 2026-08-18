import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAccessApplication } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';

// Authenticated, access-controlled document download. There are no public URLs
// to document contents; every retrieval is authorized and audited.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  // Anti-exfiltration (assessment item R5): cap how many documents one account
  // can pull in a short window, so a compromised login can't bulk-download the
  // funding-document store. Generous enough that normal review never trips it.
  const rl = await rateLimit(`doc-fetch:${session.userId}`, 150, 60);
  if (!rl.ok) {
    return new NextResponse('Too many document requests — please wait a moment and try again.', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  // ?download=1 forces a "Save as" download; otherwise the file opens inline.
  const asDownload = req.nextUrl.searchParams.get('download') === '1';

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
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.fileName)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
