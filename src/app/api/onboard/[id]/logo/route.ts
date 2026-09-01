import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { canAdminSection, isSuperAdmin } from '@/lib/rbac';
import { getDocument } from '@/lib/storage';

// Serves an uploaded new-dealer intake logo. Admin-only (the 'user-requests'
// section that reviews intakes). Files are encrypted at rest.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  if (!isSuperAdmin(session) && !canAdminSection(session, 'user-requests')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const item = await prisma.onboardRequest.findUnique({ where: { id: params.id }, select: { logoStorageKey: true, logoMime: true } });
  if (!item?.logoStorageKey) return new NextResponse('Not found', { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDocument(item.logoStorageKey);
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': item.logoMime || 'image/png',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
