import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';
import { resizedImageResponse } from '@/lib/imageResponse';
import { getScannedLeadForViewer } from '@/lib/scannedLeads';

export const dynamic = 'force-dynamic';

// The original photo of a scanned lead card. Scoped: a dealer only sees their own
// office's cards; GWA staff see all. `?size=full` for the large view.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const lead = await getScannedLeadForViewer(params.id, session);
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
