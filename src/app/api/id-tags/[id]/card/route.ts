import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getIdTagFileKeys, idTagFileName } from '@/lib/idTag';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function mimeFor(key: string): string {
  const ext = (key.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/pdf';
}

/** Serve the finished Entuitive QR card so the dealer can download & print it.
 *  Internal staff, or the owning office, may fetch it. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const tag = await getIdTagFileKeys(params.id);
  if (!tag || !tag.cardFileKey) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  const isOwner = session.role === 'DEALER_USER' && session.dealerId === tag.dealerId;
  if (!isStaff && !isOwner) return new NextResponse('Not found', { status: 404 });

  const bytes = await getDocument(tag.cardFileKey);
  const mime = mimeFor(tag.cardFileKey);
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
  const fname = idTagFileName({ personName: tag.personName, date: tag.createdAt, badgeNumber: tag.badgeNumber }, 'card', ext);
  await audit({ actorId: session.userId, action: 'DOC_DOWNLOAD', entityType: 'HomeDepotIdTag', entityId: params.id, detail: 'ID-tag card downloaded' });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
