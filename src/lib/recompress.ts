import { prisma } from './db';
import { getDocument, putDocument } from './storage';
import { sha256 } from './crypto';
import { audit } from './audit';

/**
 * One-off maintenance: shrink documents that were stored at full camera
 * resolution BEFORE the upload-time resolution cap existed. Reads each stored
 * scan, downsizes it to the same sensible resolution new uploads use, and writes
 * it back in place (same storage key) so inline previews and downloads are fast.
 *
 * Safety rules:
 *  - Only touches files over a size threshold — small files are left alone.
 *  - Only re-rasterizes a PDF that is a SCAN (no real text layer); a true
 *    text/vector PDF is never degraded.
 *  - Never writes a file back unless the result is actually smaller.
 *  - Per-file try/catch — one bad file never aborts the run.
 *  - Bounded per call (resumable): processes up to `limit` files, then reports
 *    how many large files remain so the caller can run it again. Already-shrunk
 *    files fall under the threshold, so re-running simply skips them.
 */

const RECOMPRESS_MIN_BYTES = 1_200_000; // ~1.2 MB — below this, not worth it
const TARGET_DIM = 2200; // long edge, matches the upload-time cap
const JPEG_QUALITY = 82;
const MAX_PAGES = 20; // guard against a pathological multi-page scan

export interface RecompressSummary {
  processed: number; // documents examined
  shrunk: number; // documents rewritten smaller
  skipped: number; // left untouched (small, not a scan, or no gain)
  failed: number; // couldn't be read/processed/written
  remaining: number; // large files not yet attempted this run
  beforeBytes: number; // total over the shrunk docs, before
  afterBytes: number; // total over the shrunk docs, after
}

/**
 * Downsize one stored scan (image, or image-only PDF). Returns null when it
 * shouldn't be shrunk (not a scan, has a text layer, or no meaningful gain).
 */
async function shrinkScan(bytes: Buffer, mimeType: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const sharp = (await import('sharp')).default;

  // Plain image: downsize, keep its original format (so mime/extension stay put).
  if (mimeType.startsWith('image/')) {
    const out = await sharp(bytes)
      .rotate()
      .resize({ width: TARGET_DIM, height: TARGET_DIM, fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    return out.length < bytes.length ? { bytes: out, mimeType } : null;
  }

  if (mimeType === 'application/pdf') {
    const { getDocumentProxy, extractText, renderPageAsImage } = await import('unpdf');
    const proxy = await getDocumentProxy(new Uint8Array(bytes));
    // Never degrade a real text/vector PDF — only re-rasterize an actual scan.
    try {
      const { text } = await extractText(proxy, { mergePages: true });
      if (String(text ?? '').replace(/\s+/g, '').length >= 20) return null;
    } catch {
      /* unreadable text layer → treat as a scan */
    }
    const pageCount = Math.min(proxy.numPages ?? 1, MAX_PAGES);
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    let any = false;
    for (let i = 1; i <= pageCount; i += 1) {
      let jpg: Buffer;
      try {
        // scale:1 → render at the page's native pixel size, then downsize.
        // eslint-disable-next-line no-await-in-loop
        const png = await renderPageAsImage(new Uint8Array(bytes), i, {
          canvasImport: () => import('@napi-rs/canvas'),
          scale: 1,
        });
        // eslint-disable-next-line no-await-in-loop
        jpg = await sharp(Buffer.from(png))
          .resize({ width: TARGET_DIM, height: TARGET_DIM, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY })
          .toBuffer();
      } catch {
        continue; // skip a page that won't render
      }
      // eslint-disable-next-line no-await-in-loop
      const img = await pdf.embedJpg(jpg);
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      any = true;
    }
    if (!any) return null;
    const out = Buffer.from(await pdf.save());
    return out.length < bytes.length ? { bytes: out, mimeType: 'application/pdf' } : null;
  }

  return null;
}

interface RecompressableDoc {
  id: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number | null;
}

/** The size threshold above which a stored doc is worth re-compressing. */
export const RECOMPRESS_THRESHOLD_BYTES = RECOMPRESS_MIN_BYTES;

/**
 * Re-compress ONE stored document in place. Returns what happened plus the
 * before/after byte sizes (both 0 unless it was actually shrunk). Never throws —
 * read/shrink/write failures are reported as 'failed'.
 */
async function recompressDoc(
  doc: RecompressableDoc,
  actorId: string | null,
): Promise<{ outcome: 'shrunk' | 'skipped' | 'failed'; before: number; after: number }> {
  let bytes: Buffer;
  try {
    bytes = await getDocument(doc.storageKey);
  } catch (e) {
    console.error('[recompress] read failed', doc.id, e);
    return { outcome: 'failed', before: 0, after: 0 };
  }

  let result: { bytes: Buffer; mimeType: string } | null = null;
  try {
    result = await shrinkScan(bytes, doc.mimeType);
  } catch (e) {
    console.error('[recompress] shrink failed', doc.id, e);
    return { outcome: 'failed', before: 0, after: 0 };
  }
  if (!result) {
    // Deliberately not shrunk (a real text PDF, or no size gain) — mark it done
    // so the sweep doesn't keep re-reading it. Best-effort.
    await prisma.document
      .update({ where: { id: doc.id }, data: { recompressedAt: new Date() } })
      .catch(() => {});
    return { outcome: 'skipped', before: 0, after: 0 };
  }

  try {
    await putDocument(doc.storageKey, result.bytes); // overwrite in place
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        sizeBytes: result.bytes.length,
        checksum: sha256(result.bytes),
        mimeType: result.mimeType,
        recompressedAt: new Date(),
      },
    });
  } catch (e) {
    console.error('[recompress] write failed', doc.id, e);
    return { outcome: 'failed', before: 0, after: 0 };
  }

  await audit({
    actorId,
    action: 'DOC_RECOMPRESS',
    entityType: 'Document',
    entityId: doc.id,
    detail: `Re-compressed ${doc.fileName}: ${bytes.length} → ${result.bytes.length} bytes`,
  });
  return { outcome: 'shrunk', before: bytes.length, after: result.bytes.length };
}

/** Re-compress a deal's oversized stored scans, up to `limit` per call. */
export async function recompressApplicationDocuments(
  applicationId: string,
  actorId: string,
  limit = 10,
): Promise<RecompressSummary> {
  const docs = await prisma.document.findMany({
    where: { applicationId, sizeBytes: { gte: RECOMPRESS_MIN_BYTES }, recompressedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, storageKey: true, mimeType: true, fileName: true, sizeBytes: true },
  });

  const sum: RecompressSummary = {
    processed: 0, shrunk: 0, skipped: 0, failed: 0, remaining: 0, beforeBytes: 0, afterBytes: 0,
  };

  for (const doc of docs) {
    // Bound the work per call; count the rest as "remaining" so the caller knows
    // to run it again.
    if (sum.shrunk >= limit) {
      sum.remaining += 1;
      continue;
    }
    sum.processed += 1;
    // eslint-disable-next-line no-await-in-loop
    const r = await recompressDoc(doc, actorId);
    if (r.outcome === 'shrunk') {
      sum.shrunk += 1;
      sum.beforeBytes += r.before;
      sum.afterBytes += r.after;
    } else if (r.outcome === 'failed') {
      sum.failed += 1;
    } else {
      sum.skipped += 1;
    }
  }

  return sum;
}

/**
 * Portal-wide sweep: re-compress a batch of the biggest oversized stored scans
 * across ALL deals, then report how many oversized docs still remain. Designed
 * to be called repeatedly by a scheduled job — it drains the backlog a batch at
 * a time and naturally no-ops once every file is under the threshold (the
 * upload-time cap keeps new ones small, so the backlog never regrows). Peak
 * memory is ~one document regardless of batch size (sequential).
 */
export async function recompressOversizedBatch(
  limit: number,
  actorId: string | null,
): Promise<RecompressSummary> {
  const docs = await prisma.document.findMany({
    where: { sizeBytes: { gte: RECOMPRESS_MIN_BYTES }, recompressedAt: null },
    orderBy: { sizeBytes: 'desc' }, // biggest first — best bytes-saved per run
    take: limit,
    select: { id: true, storageKey: true, mimeType: true, fileName: true, sizeBytes: true },
  });

  const sum: RecompressSummary = {
    processed: 0, shrunk: 0, skipped: 0, failed: 0, remaining: 0, beforeBytes: 0, afterBytes: 0,
  };

  for (const doc of docs) {
    sum.processed += 1;
    // eslint-disable-next-line no-await-in-loop
    const r = await recompressDoc(doc, actorId);
    if (r.outcome === 'shrunk') {
      sum.shrunk += 1;
      sum.beforeBytes += r.before;
      sum.afterBytes += r.after;
    } else if (r.outcome === 'failed') {
      sum.failed += 1;
    } else {
      sum.skipped += 1;
    }
  }

  // How many oversized docs the sweep will still act on (not yet processed).
  sum.remaining = await prisma.document.count({
    where: { sizeBytes: { gte: RECOMPRESS_MIN_BYTES }, recompressedAt: null },
  });
  return sum;
}
