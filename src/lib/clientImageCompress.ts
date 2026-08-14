/**
 * Client-side (browser) image downscaling for uploads.
 *
 * Big phone photos (a 4–8 MB HEIC/JPEG) upload slowly on cell data. This shrinks
 * them before they leave the device — long side capped and re-encoded as JPEG —
 * while keeping documents easily readable (fine print, account numbers, serials
 * all stay legible at these settings).
 *
 * It is deliberately best-effort and non-destructive:
 *  - Non-images (PDFs) and already-small files are returned untouched.
 *  - Anything the browser can't decode (e.g. HEIC on Chrome) is returned as-is;
 *    the server handles those.
 *  - If re-encoding wouldn't actually be smaller, the original is kept.
 */

const MAX_DIM = 2400; // longest side in px — high enough that small print stays sharp
const QUALITY = 0.82; // JPEG quality — visually clean text, big size win
const MIN_BYTES = 500 * 1024; // below this, not worth touching

export async function compressImageFile(file: File): Promise<File> {
  if (typeof document === 'undefined') return file; // never on the server
  if (!file.type.startsWith('image/')) return file; // PDFs etc. untouched
  if (file.size < MIN_BYTES) return file;

  try {
    const src = await loadImage(file);
    if (!src) return file;
    const w0 = 'width' in src ? src.width : 0;
    const h0 = 'height' in src ? src.height : 0;
    if (!w0 || !h0) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
    if ('close' in src && typeof (src as ImageBitmap).close === 'function') (src as ImageBitmap).close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file; // no win — keep original

    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Compress a list of files in parallel (non-images pass straight through). */
export async function compressFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageFile(f)));
}

/** Rebuild a FileList from Files (for assigning back to an <input type="file">). */
export function toFileList(files: File[]): FileList | null {
  try {
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    return dt.files;
  } catch {
    return null;
  }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* HEIC / unsupported — fall through to <img> */
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
