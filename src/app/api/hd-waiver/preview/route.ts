import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { fillHdWaiver } from '@/lib/hdWaiver';

export const dynamic = 'force-dynamic';

/**
 * Staff-only LIVE PREVIEW of the pre-filled Home Depot waiver — a test area so
 * you can see the auto-fill working without a real deal. Open
 *   /api/hd-waiver/preview
 * for a sample, or pass your own values to test:
 *   /api/hd-waiver/preview?store=7137&name=Lily%20Li&address=11%20King%20St,%20Barrie%20ON&company=Georgian%20Water%20%26%20Air
 * Opens inline in the browser (not a download) so it's quick to eyeball.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== 'REVIEWER' && session.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  const bytes = await fillHdWaiver({
    storeNumber: q.get('store') || '7137',
    customerName: q.get('name') || 'Sample Customer',
    jobSiteAddress: q.get('address') || '123 Main St, Barrie, ON L4M 1A1',
    installerCompany: q.get('company') || 'Georgian Water & Air',
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="HD-Waiver-preview.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
