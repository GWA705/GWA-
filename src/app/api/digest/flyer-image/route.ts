import { NextResponse } from 'next/server';
import { getDigestFlyer } from '@/lib/settings';
import { getDocument } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function mimeFor(key: string): string {
  const ext = (key.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

/**
 * The current dealer-snapshot flyer image. PUBLIC (no auth) so email clients can
 * load it — it's a marketing flyer, not sensitive. Cache-busted by the `?v=`
 * (the storage key) the email appends, so a new flyer always refreshes.
 */
export async function GET() {
  const flyer = await getDigestFlyer();
  if (!flyer || !flyer.imageKey) return new NextResponse('Not found', { status: 404 });
  const bytes = await getDocument(flyer.imageKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeFor(flyer.imageKey),
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': 'inline',
    },
  });
}
