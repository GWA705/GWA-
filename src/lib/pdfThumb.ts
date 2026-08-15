import 'server-only';
import sharp from 'sharp';

/**
 * Rasterize the first page of a PDF into a small webp thumbnail. Runs at upload
 * time so a real page preview shows on every device (including mobile Safari,
 * which can't render PDFs inline). Best-effort: any failure returns null and the
 * caller falls back to a plain PDF tile — a missing thumbnail never breaks the
 * upload. The heavy renderer is imported dynamically so a missing native binary
 * can't break module load or the build.
 */
export async function pdfFirstPageThumb(pdfBytes: Buffer): Promise<Buffer | null> {
  try {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(pdfBytes, { scale: 1.5 });
    let firstPng: Buffer | null = null;
    for await (const page of doc) {
      firstPng = page as Buffer;
      break; // first page only
    }
    if (!firstPng) return null;
    return await sharp(firstPng)
      .flatten({ background: '#ffffff' })
      .resize({ width: 360, height: 480, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
  } catch (e) {
    console.error('[pdfThumb] first-page render failed', e);
    return null;
  }
}
