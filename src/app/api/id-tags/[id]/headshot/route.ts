import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getIdTagFileKeys, idTagFileName } from '@/lib/idTag';
import { getDocument } from '@/lib/storage';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function mimeFor(key: string): string {
  const ext = (key.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.pdf') return 'application/pdf';
  return 'image/jpeg';
}

/** Serve a person's headshot. Internal staff, or the owning office, may view it. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const tag = await getIdTagFileKeys(params.id);
  if (!tag || !tag.headshotKey) return new NextResponse('Not found', { status: 404 });

  const isStaff = session.role === 'REVIEWER' || session.role === 'ADMIN';
  const isOwner = session.role === 'DEALER_USER' && session.dealerId === tag.dealerId;
  if (!isStaff && !isOwner) return new NextResponse('Not found', { status: 404 });

  const bytes = await getDocument(tag.headshotKey);
  const ext = (tag.headshotKey.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').replace('.', '').toLowerCase();
  const fname = idTagFileName({ personName: tag.personName, date: tag.startedDate, badgeNumber: tag.badgeNumber }, 'photo', ext);
  await audit({ actorId: session.userId, action: 'DOC_DOWNLOAD', entityType: 'HomeDepotIdTag', entityId: params.id, detail: 'ID-tag headshot viewed' });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': mimeFor(tag.headshotKey), 'Content-Disposition': `inline; filename="${fname}"`, 'Cache-Control': 'no-store' },
  });
}
