import { NextResponse, type NextRequest } from 'next/server';
import sharp from 'sharp';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getDocument } from '@/lib/storage';

// Serves a resource product's photo to any signed-in user.
//
// Product photos are stored at full camera resolution (often several MB), which
// made every card and the library grid slow to paint. We resize on the fly to a
// web-friendly WebP — small (`?size=card`, the default) for tiles and a larger
// one (`?size=full`) for the lightbox — and cache it hard. The image URL is
// versioned (`?v=<updatedAt>`), so a replaced photo busts the cache on its own,
// which lets us mark the response immutable for a year.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  const p = await prisma.resourceProduct.findUnique({
    where: { id: params.id },
    select: { imageStorageKey: true, imageMime: true },
  });
  if (!p || !p.imageStorageKey) return new NextResponse('Not found', { status: 404 });

  const width = req.nextUrl.searchParams.get('size') === 'full' ? 1400 : 640;
  const versioned = req.nextUrl.searchParams.has('v');
  const cache = versioned
    ? 'private, max-age=31536000, immutable'
    : 'private, max-age=86400';

  try {
    const bytes = await getDocument(p.imageStorageKey);
    let out: Buffer;
    let mime = 'image/webp';
    try {
      out = await sharp(Buffer.from(bytes))
        .rotate() // respect EXIF orientation
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      // Not resizable for some reason — serve the original untouched.
      out = Buffer.from(bytes);
      mime = p.imageMime || 'image/jpeg';
    }
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': cache,
      },
    });
  } catch {
    return new NextResponse('Unavailable', { status: 500 });
  }
}
