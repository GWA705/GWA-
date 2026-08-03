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
