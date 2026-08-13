import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves a resource-library file to any signed-in user. Default is inline
// (View — PDFs/images render in the browser); ?download=1 forces a save.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const f = await prisma.resourceProductFile.findUnique({ where: { id: params.id } });
  if (!f) return new NextResponse('Not found', { status: 404 });

  const download = req.nextUrl.searchParams.get('download') === '1';
  // Build a friendly filename from the original name (fallback to the label/id).
  const safeName = (f.originalName || f.label || 'resource').replace(/[^a-zA-Z0-9._ -]/g, '_');

  try {
    const bytes = await getDocument(f.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': f.mime || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
