import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternal } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/ratelimit';

// Authenticated, access-controlled download of a resolution-case attachment.
// Internal staff only; rate-limited like the deal-document route; audited.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!isInternal(session)) return new NextResponse('Forbidden', { status: 403 });

  const rl = await rateLimit(`res-attach:${session.userId}`, 150, 60);
  if (!rl.ok) {
    return new NextResponse('Too many requests — please wait a moment and try again.', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec) },
    });
  }

  const a = await prisma.resolutionAttachment.findUnique({ where: { id: params.id } });
  if (!a || a.kind !== 'file' || !a.storageKey) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(a.storageKey);
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }

  await audit({ actorId: session.userId, action: 'CUSTOMER_SEARCH', entityType: 'ResolutionCase', entityId: a.caseId, detail: 'viewed case attachment' });

  const asDownload = req.nextUrl.searchParams.get('download') === '1';
  const filename = (a.fileName || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': a.mimeType || 'application/octet-stream',
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
