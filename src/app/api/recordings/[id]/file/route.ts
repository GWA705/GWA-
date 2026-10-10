import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { isInternalRole } from '@/lib/constants';
import { presignRecordingDownload } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Stream/download a manually-uploaded recording video. Any signed-in user can
 * fetch a PUBLISHED recording; staff/admin can also preview a pending one. We
 * redirect to a short-lived presigned S3 URL so the bytes stream straight from
 * S3 (range requests + seeking work natively) and never pass through this server.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const rec = await prisma.zoomRecording.findUnique({
    where: { id: params.id },
    select: { status: true, fileKey: true, fileType: true, title: true, topic: true },
  });
  if (!rec || !rec.fileKey) return new NextResponse('Not found', { status: 404 });
  if (rec.status !== 'PUBLISHED' && !isInternalRole(session.role)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const extByType: Record<string, string> = {
    'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm',
    'video/x-matroska': '.mkv', 'video/x-msvideo': '.avi',
  };
  const ext = extByType[rec.fileType || ''] || '.mp4';
  const name = `${(rec.title || rec.topic || 'recording').trim()}${ext}`;

  try {
    const url = await presignRecordingDownload(rec.fileKey, name);
    return NextResponse.redirect(url, 302);
  } catch (e) {
    console.error('[recordings/file] presign failed', e);
    return new NextResponse('Unavailable', { status: 500 });
  }
}
