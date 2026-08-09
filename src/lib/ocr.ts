import path from 'node:path';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { renderPageAsImage } from 'unpdf';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { getDocument } from './storage';
import { findDates } from './docanalysis';
import type { DocAnalysis } from './docanalysis-format';

/**
 * Tier-2 OCR (assistive, on-prem — no data leaves the portal). Reads scans and
 * photos that the Tier-1 text-layer pass couldn't, so the reviewer's Auto-check
 * chips show dates from scanned funding docs too. Uses tesseract.js (WASM, no
 * native binaries) with a vendored English model (ocr-langs/), and unpdf +
 * @napi-rs/canvas to rasterize PDF pages. Never throws out — failures are
 * recorded and the pending flag cleared so nothing loops or blocks.
 */

// Vendored language data — avoids any runtime CDN dependency. cachePath is a
// writable scratch dir on the server.
const LANG_PATH = path.join(process.cwd(), 'ocr-langs');
const CACHE_PATH = '/tmp/ocr-cache';
// Cap work per document so a huge scan can't tie up the worker.
export const OCR_MAX_PAGES = 12;

async function pdfPageCount(bytes: Buffer): Promise<number> {
  try {
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    return pdf.numPages ?? 1;
  } catch {
    return 1;
  }
}

async function rasterizePages(bytes: Buffer, pages: number): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (let i = 1; i <= pages; i += 1) {
    try {
      const img = await renderPageAsImage(new Uint8Array(bytes), i, {
        canvasImport: () => import('@napi-rs/canvas'),
        scale: 2,
      });
      out.push(Buffer.from(img));
    } catch {
      /* skip a page that won't render */
    }
  }
  return out;
}

/** OCR the readable text out of a stored document's bytes. */
export async function ocrBytes(
  bytes: Buffer,
  mimeType: string,
  maxPages = OCR_MAX_PAGES,
): Promise<{ text: string; pages: number }> {
  let images: Buffer[] = [];
  if (mimeType === 'application/pdf') {
    const count = Math.min(await pdfPageCount(bytes), maxPages);
    images = await rasterizePages(bytes, count);
  } else if (mimeType.startsWith('image/')) {
    images = [await sharp(bytes).png().toBuffer()];
  }
  if (images.length === 0) return { text: '', pages: 0 };

  const worker = await createWorker('eng', 1, { langPath: LANG_PATH, cachePath: CACHE_PATH, gzip: true });
  try {
    const parts: string[] = [];
    for (const img of images) {
      const { data } = await worker.recognize(img);
      parts.push(data.text ?? '');
    }
    return { text: parts.join('\n'), pages: images.length };
  } finally {
    await worker.terminate();
  }
}

/**
 * OCR one stored document and merge the result into its analysis. Always clears
 * ocrPending (success or give-up) so the queue drains and never loops.
 */
export async function runDocumentOcr(documentId: string): Promise<{ ok: boolean; dates?: string[] }> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { ok: false };

  const analysis = (doc.analysis ?? {}) as Partial<DocAnalysis>;
  if (analysis.ocr?.used) {
    await prisma.document.update({ where: { id: documentId }, data: { ocrPending: false } });
    return { ok: true, dates: analysis.ocr.dates };
  }

  try {
    const bytes = await getDocument(doc.storageKey);
    const { text, pages } = await ocrBytes(bytes, doc.mimeType);
    const dates = findDates(text.replace(/\s+/g, ' '));
    const merged: Partial<DocAnalysis> = {
      ...analysis,
      ocr: {
        used: true,
        dates: dates.slice(0, 12),
        note: pages > 0 ? `Read ${pages} page${pages === 1 ? '' : 's'} by OCR` : 'Nothing readable',
      },
    };
    await prisma.document.update({
      where: { id: documentId },
      data: { analysis: merged as unknown as Prisma.InputJsonValue, ocrPending: false },
    });
    return { ok: true, dates };
  } catch (e) {
    console.error('[ocr] failed for document', documentId, e);
    const merged: Partial<DocAnalysis> = {
      ...analysis,
      ocr: { used: false, note: 'OCR could not read this document.' },
    };
    await prisma.document
      .update({ where: { id: documentId }, data: { analysis: merged as unknown as Prisma.InputJsonValue, ocrPending: false } })
      .catch(() => {});
    return { ok: false };
  }
}

/** Process a batch of queued scans (used by the scheduled job). */
export async function runPendingOcr(limit = 5): Promise<{ processed: number }> {
  const pending = await prisma.document.findMany({
    where: { ocrPending: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const d of pending) {
    // Sequential — one OCR worker at a time keeps memory bounded.
    // eslint-disable-next-line no-await-in-loop
    await runDocumentOcr(d.id);
  }
  return { processed: pending.length };
}
