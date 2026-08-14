import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternal, canAccessApplication } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

// Authenticated, access-controlled playback/download of a call recording. No
// public URLs; every retrieval is authorized and audited.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rec = await prisma.callRecording.findUnique({ where: { id: params.id } });
  if (!rec) return new NextResponse('Not found', { status: 404 });

  // Internal staff can hear any recording; a dealer only their own deal's.
  const allowed = isInternal(session) || (rec.dealerId ? canAccessApplication(session, rec.dealerId) : false);
  if (!allowed) return new NextResponse('Forbidden', { status: 403 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(rec.storageKey);
  } catch (err) {
    console.error('[call-recordings] retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }

  await audit({
    actorId: session.userId,
    action: 'DOC_DOWNLOAD',
    entityType: 'CallRecording',
    entityId: rec.id,
    detail: rec.applicationId ? `application ${rec.applicationId}` : 'unmatched recording',
  });

  const asDownload = req.nextUrl.searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': rec.mime || 'audio/mpeg',
      'Content-Length': String(bytes.length),
      'Accept-Ranges': 'none',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      ...(asDownload ? { 'Content-Disposition': `attachment; filename="recording-${rec.id}.mp3"` } : {}),
    },
  });
}
