import { NextResponse } from 'next/server';
import sharp from 'sharp';

/**
 * One place that turns stored image bytes into a fast, cache-friendly HTTP
 * response. Every route that serves a stored photo (product photos, marketplace
 * gear, announcement banners) should go through this so we never re-introduce
 * the "multi-MB original served on every request" problem.
 *
 * - Downscales to `width` and re-encodes as WebP (huge byte savings), falling
 *   back to the untouched original if the source isn't resizable.
 * - Respects EXIF orientation.
 * - Caches hard. When the caller's image URL is versioned (a `?v=` that changes
 *   whenever the image is replaced), pass `versioned: true` to cache it
 *   immutably for a year; otherwise it caches for `maxAgeSeconds` (default 1 day).
 *
 * Responses are marked `private` because the images sit behind auth.
 */
export async function resizedImageResponse(
  bytes: Buffer | Uint8Array,
  opts: {
    width: number;
    versioned?: boolean;
    fallbackMime?: string | null;
    maxAgeSeconds?: number;
  },
): Promise<NextResponse> {
  const src = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  let out = src;
  let mime = 'image/webp';
  try {
    out = await sharp(src)
      .rotate()
      .resize({ width: opts.width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    // Not a resizable image (or sharp unavailable) — serve the original bytes.
    out = src;
    mime = opts.fallbackMime || 'image/jpeg';
  }

  const cache = opts.versioned
    ? 'private, max-age=31536000, immutable'
    : `private, max-age=${opts.maxAgeSeconds ?? 86400}`;

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cache,
    },
  });
}
