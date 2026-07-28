import { PDFDocument } from 'pdf-lib';

/**
 * Convert an uploaded file to PDF for consistent storage.
 *  - PDFs are kept as-is.
 *  - Images (JPEG/PNG/WEBP/HEIC) are normalized via sharp and embedded into a
 *    single-page PDF sized to the image.
 *  - Anything that can't be converted is returned unchanged (converted=false)
 *    so an upload is never lost.
 *
 * sharp is imported lazily so the module only loads the native binary when a
 * conversion actually runs.
 */
export interface ConvertResult {
  bytes: Buffer;
  mimeType: string;
  converted: boolean;
}

export async function convertToPdf(input: Buffer, mimeType: string): Promise<ConvertResult> {
  if (mimeType === 'application/pdf') {
    return { bytes: input, mimeType: 'application/pdf', converted: false };
  }

  if (mimeType.startsWith('image/')) {
    try {
      const sharp = (await import('sharp')).default;
      const jpg = await sharp(input).rotate().jpeg({ quality: 85 }).toBuffer();
      const pdf = await PDFDocument.create();
      const img = await pdf.embedJpg(jpg);
      const page = pdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      const bytes = Buffer.from(await pdf.save());
      return { bytes, mimeType: 'application/pdf', converted: true };
    } catch (err) {
      console.error('[pdf] image->pdf conversion failed; storing original', err);
      return { bytes: input, mimeType, converted: false };
    }
  }

  return { bytes: input, mimeType, converted: false };
}

/** Build a standardized, human-readable document file name. */
export function buildDocumentName(params: {
  firstName: string;
  lastName: string;
  purchaseDate: Date | null;
  when: Date;
  isPdf: boolean;
  originalName: string;
}): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 40) || 'x';
  const d = (dt: Date) => dt.toISOString().slice(0, 10); // YYYY-MM-DD
  const stamp = params.when
    .toISOString()
    .slice(0, 19)
    .replace(/[-:T]/g, (c) => (c === 'T' ? '-' : ''));
  const purchase = params.purchaseDate ? d(params.purchaseDate) : 'nodate';
  const base = `${clean(params.lastName)}_${clean(params.firstName)}_${purchase}_${stamp}`;
  if (params.isPdf) return `${base}.pdf`;
  const ext = params.originalName.includes('.')
    ? params.originalName.slice(params.originalName.lastIndexOf('.'))
    : '';
  return `${base}${ext}`;
}
