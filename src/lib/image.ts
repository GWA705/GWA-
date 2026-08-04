// Normalize an uploaded photo to a consistent, web-friendly form so product
// images look uniform no matter what the uploader provides:
//  - apply EXIF orientation (so phone photos aren't sideways),
//  - resize to fit within a sensible max box (no upscaling of small images),
//  - re-encode as compressed WebP.
// sharp is imported lazily so the native binary only loads when an image is
// actually processed.
// A small square thumbnail (cropped to fill) for inline attachment previews.
export async function thumbnailImage(input: Buffer, maxDim = 256): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(input)
    .rotate()
    .resize(maxDim, maxDim, { fit: 'cover', position: 'centre' })
    .webp({ quality: 70 })
    .toBuffer();
}

// Shrink a large image attachment while keeping it clearly readable (for mail
// attachments — photos, flyers). Only downscales images bigger than maxDim and
// re-encodes at good quality; small images come back barely changed. Keeps the
// original format for JPEG/PNG/WEBP; converts HEIC (which browsers can't show)
// to JPEG. Returns the new bytes + mime + file extension. Non-images return null
// so the caller stores the original untouched (e.g. PDFs).
export async function optimizeAttachmentImage(
  input: Buffer,
  mime: string,
  maxDim = 2000,
): Promise<{ bytes: Buffer; mime: string; ext: string } | null> {
  if (!mime.startsWith('image/')) return null;
  const sharp = (await import('sharp')).default;
  const base = sharp(input).rotate().resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true });
  if (mime === 'image/png') {
    return { bytes: await base.png({ compressionLevel: 9 }).toBuffer(), mime: 'image/png', ext: '.png' };
  }
  if (mime === 'image/webp') {
    return { bytes: await base.webp({ quality: 85 }).toBuffer(), mime: 'image/webp', ext: '.webp' };
  }
  // JPEG, HEIC, and anything else photographic → JPEG at a reviewer-readable q85.
  return { bytes: await base.jpeg({ quality: 85 }).toBuffer(), mime: 'image/jpeg', ext: '.jpg' };
}

export async function normalizeProductImage(
  input: Buffer,
  maxDim = 1200,
): Promise<{ bytes: Buffer; mime: string }> {
  const sharp = (await import('sharp')).default;
  const bytes = await sharp(input)
    .rotate() // bake in EXIF orientation
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return { bytes, mime: 'image/webp' };
}
