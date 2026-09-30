import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';
import { getScannedLeadForViewer } from '@/lib/scannedLeads';
import { prisma } from '@/lib/db';
import { peerToken, bearerMatches } from '@/lib/portalPeer';

export const dynamic = 'force-dynamic';

// The original photo of a scanned lead card. Two callers:
//  - a portal user (session): scoped — a dealer sees only their own office's
//    cards; GWA staff see all.
//  - the booking server (shared-secret bearer token): the booking app proxies
//    this so a scanned card's photo shows on the booker's calling screen. The
//    token stays server-side; the image never becomes a public URL.
// `?size=full` for the large view.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const expected = peerToken();
  const asPeer = !!expected && bearerMatches(req, expected);

  let lead: { photoStorageKey: string | null; photoMime: string | null } | null = null;
  if (asPeer) {
    // Server-to-server: look the card up directly, no office scope.
    lead = await prisma.scannedLead.findUnique({
      where: { id: params.id },
      select: { photoStorageKey: true, photoMime: true },
    });
  } else {
    const session = await getSession();
    if (!session) return new NextResponse('Unauthorized', { status: 401 });
    lead = await getScannedLeadForViewer(params.id, session);
  }
  if (!lead?.photoStorageKey) return new NextResponse('Not found', { status: 404 });

  const width = req.nextUrl.searchParams.get('size') === 'full' ? 1400 : 640;
  try {
    const bytes = await getDocument(lead.photoStorageKey);
    return await resizedImageResponse(bytes, { width, fallbackMime: lead.photoMime });
  } catch (err) {
    console.error('[scanned-lead] photo retrieval failed', err);
    return new NextResponse('Unavailable', { status: 500 });
  }
}
