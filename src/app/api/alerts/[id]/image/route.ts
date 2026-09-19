import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';
import { alertWhereForUser } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

// The image on a must-read pop-up alert. Scoped: only a user the alert is
// targeted to (its audience) can fetch it — the same rule that decides whether
// the pop-up is shown.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const alert = await prisma.dealerAlert.findFirst({
    where: { id: params.id, ...alertWhereForUser(session.role, session.dealerId, session.userId) },
    select: { imageStorageKey: true, imageMime: true },
  });
  if (!alert?.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  const width = req.nextUrl.searchParams.get('size') === 'full' ? 1600 : 900;
  try {
    const bytes = await getDocument(alert.imageStorageKey);
    return await resizedImageResponse(bytes, { width, fallbackMime: alert.imageMime });
  } catch (err) {
    console.error('[alert-image] retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }
}
