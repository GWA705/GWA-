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

/**
 * Render EVERY page of a PDF and stack them into one tall webp image, so the
 * whole document can be shown as a single scrollable image inside the app. This
 * is the reliable way to view a multi-page PDF on iOS (where an <iframe> only
 * shows page 1 and won't scroll). Best-effort → null on failure. Capped so a
 * huge PDF can't produce an unbounded image.
 */
export async function renderPdfPagesStacked(pdfBytes: Buffer, maxPages = 40): Promise<Buffer | null> {
  try {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(pdfBytes, { scale: 2 });
    const width = 1100;
    const gap = 14;

    const pageBufs: Buffer[] = [];
    for await (const page of doc) {
      const norm = await sharp(page as Buffer)
        .flatten({ background: '#ffffff' })
        .resize({ width, withoutEnlargement: true })
        .toBuffer();
      pageBufs.push(norm);
      if (pageBufs.length >= maxPages) break;
    }
    if (pageBufs.length === 0) return null;
    if (pageBufs.length === 1) {
      return await sharp(pageBufs[0]).webp({ quality: 78 }).toBuffer();
    }

    const metas = await Promise.all(pageBufs.map((b) => sharp(b).metadata()));
    const heights = metas.map((m) => m.height ?? 0);
    const totalH = heights.reduce((s, h) => s + h, 0) + gap * (pageBufs.length - 1);

    let top = 0;
    const composites = pageBufs.map((input, i) => {
      const item = { input, top, left: 0 };
      top += heights[i] + gap;
      return item;
    });

    return await sharp({ create: { width, height: totalH, channels: 3, background: '#ffffff' } })
      .composite(composites)
      .webp({ quality: 76 })
      .toBuffer();
  } catch (e) {
    console.error('[pdfThumb] full-pages render failed', e);
    return null;
  }
}
