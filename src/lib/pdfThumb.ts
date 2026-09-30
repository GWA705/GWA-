import 'server-only';
import sharp from 'sharp';
import { withConcurrencyLimit } from './concurrency';

/**
 * Rasterize the first page of a PDF into a small webp thumbnail. Runs at upload
 * time so a real page preview shows on every device (including mobile Safari,
 * which can't render PDFs inline). Best-effort: any failure returns null and the
 * caller falls back to a plain PDF tile — a missing thumbnail never breaks the
 * upload. The heavy renderer is imported dynamically so a missing native binary
 * can't break module load or the build.
 */
export async function pdfFirstPageThumb(pdfBytes: Buffer): Promise<Buffer | null> {
  // Cap concurrent PDF rasterization (memory-heavy) across the instance.
  return withConcurrencyLimit('pdf-render', 2, () => pdfFirstPageThumbInner(pdfBytes));
}

async function pdfFirstPageThumbInner(pdfBytes: Buffer): Promise<Buffer | null> {
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
 * Render EVERY page of a PDF and stack them into one tall JPEG image, so the
 * whole document can be shown as a single scrollable image inside the app. This
 * is the reliable way to view a multi-page PDF on iOS (where an <iframe> only
 * shows page 1 and won't scroll). Best-effort → null on failure.
 *
 * Output is JPEG, not WebP: WebP has a hard 16,383px dimension ceiling, so a
 * stacked doc past ~11 letter pages exceeded it and the whole render failed
 * ("Couldn't render a preview"). JPEG allows up to 65,535px. We still guard the
 * running height (SAFE_MAX_H) so even legal-size / very dense pages can't push
 * the stack past the JPEG ceiling — pages beyond the limit are dropped and the
 * viewer's "open in new tab / download" fallback covers the rest.
 */
export async function renderPdfPagesStacked(pdfBytes: Buffer, maxPages = 40): Promise<Buffer | null> {
  // Shares the pdf-render pool with the thumbnail renderer — both rasterize pages
  // and are the memory-heaviest path when several people open PDFs at once.
  return withConcurrencyLimit('pdf-render', 2, () => renderPdfPagesStackedInner(pdfBytes, maxPages));
}

// Keep the stacked image safely under the JPEG dimension ceiling (65,535px),
// with headroom for the inter-page gaps.
const SAFE_MAX_H = 60000;

async function renderPdfPagesStackedInner(pdfBytes: Buffer, maxPages: number): Promise<Buffer | null> {
  try {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(pdfBytes, { scale: 2 });
    const width = 1100;
    const gap = 14;

    const pageBufs: Buffer[] = [];
    const heights: number[] = [];
    let stackedH = 0;
    for await (const page of doc) {
      const norm = await sharp(page as Buffer)
        .flatten({ background: '#ffffff' })
        .resize({ width, withoutEnlargement: true })
        .toBuffer();
      const h = (await sharp(norm).metadata()).height ?? 0;
      // Stop before this page would push the stack past the format ceiling.
      const addedH = h + (pageBufs.length > 0 ? gap : 0);
      if (pageBufs.length > 0 && stackedH + addedH > SAFE_MAX_H) break;
      pageBufs.push(norm);
      heights.push(h);
      stackedH += addedH;
      if (pageBufs.length >= maxPages) break;
    }
    if (pageBufs.length === 0) return null;
    if (pageBufs.length === 1) {
      return await sharp(pageBufs[0]).jpeg({ quality: 80 }).toBuffer();
    }

    const totalH = heights.reduce((s, h) => s + h, 0) + gap * (pageBufs.length - 1);

    let top = 0;
    const composites = pageBufs.map((input, i) => {
      const item = { input, top, left: 0 };
      top += heights[i] + gap;
      return item;
    });

    return await sharp({ create: { width, height: totalH, channels: 3, background: '#ffffff' } })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (e) {
    console.error('[pdfThumb] full-pages render failed', e);
    return null;
  }
}
