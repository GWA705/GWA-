import 'server-only';
import crypto from 'crypto';
import path from 'path';
import { putDocument } from './storage';
import { MAX_FILE_BYTES, RESOURCE_FILE_MIME_TYPES } from './constants';
import { pdfFirstPageThumb } from './pdfThumb';

/**
 * Store a resource-library blob (product photo or an attached file) in the
 * encrypted object store and return its key + metadata. Validates size and MIME.
 * Files are kept in their original format (PDFs stay PDFs — no conversion), so
 * dealers can view or download the real document.
 */
export async function storeResourceBlob(
  prefix: string,
  file: File,
  opts: { imageOnly?: boolean } = {},
): Promise<{ key: string; mime: string; size: number; name: string; thumbKey?: string; thumbMime?: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: 'No file provided.' };
  if (file.size > MAX_FILE_BYTES) {
    return { error: `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
  }
  const allowed = opts.imageOnly ? RESOURCE_FILE_MIME_TYPES.filter((m) => m.startsWith('image/')) : RESOURCE_FILE_MIME_TYPES;
  if (!allowed.includes(file.type)) {
    return { error: opts.imageOnly ? 'The photo must be a JPG, PNG, or WEBP image.' : `Unsupported file type: ${file.type || 'unknown'}.` };
  }
  const ext = path.extname(file.name).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '') || (file.type === 'application/pdf' ? '.pdf' : '.bin');
  const key = `${prefix}/${crypto.randomBytes(8).toString('hex')}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    await putDocument(key, buf);
  } catch {
    return { error: 'The file could not be saved. Please try again.' };
  }

  // For PDFs, render a first-page thumbnail so a preview shows everywhere.
  let thumbKey: string | undefined;
  let thumbMime: string | undefined;
  if (file.type === 'application/pdf') {
    const thumb = await pdfFirstPageThumb(buf);
    if (thumb) {
      const tKey = `${prefix}/${crypto.randomBytes(8).toString('hex')}.webp`;
      try {
        await putDocument(tKey, thumb);
        thumbKey = tKey;
        thumbMime = 'image/webp';
      } catch {
        /* thumbnail is best-effort */
      }
    }
  }

  return { key, mime: file.type, size: file.size, name: file.name, thumbKey, thumbMime };
}
