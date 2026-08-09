import type { DocumentStage, DocumentType } from '@prisma/client';
import { prisma } from './db';
import { putDocument, newStorageKey } from './storage';
import { sha256 } from './crypto';
import { audit } from './audit';
import { convertToPdf, buildDocumentName } from './pdf';
import { analyzeDocument } from './docanalysis';
import { extractTextForScan } from './ocr';
import { findCardData, CARD_BLOCK_MESSAGE } from './cardscan';
import { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from './constants';
import type { Prisma } from '@prisma/client';

export interface UploadResult {
  ok: boolean;
  error?: string;
  documentId?: string;
}

// Identify a file by its magic bytes so we don't trust the client-declared MIME.
// Returns a supported MIME type, or null when the content isn't recognized.
function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === '%PDF') return 'application/pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP')
    return 'image/webp';
  // HEIC/HEIF: an ISO-BMFF 'ftyp' box with a HEIF-family brand.
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12).toLowerCase();
    const heifBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs', 'heif'];
    if (heifBrands.includes(brand)) return 'image/heic';
  }
  return null;
}

export interface ApplicationContext {
  id: string;
  dealerId: string;
  applicantFirstName: string;
  applicantLastName: string;
  dateOfSale: Date | null;
}

/**
 * Validate, convert-to-PDF, and store an uploaded file for an application.
 *  - Every accepted file is converted to PDF where possible (images -> PDF).
 *  - Stored under an organized per-dealer key and given a standardized,
 *    customer + date + timestamp file name.
 *  - Bytes are application-encrypted at rest by the storage layer.
 * Caller is responsible for authorization (that this user may write here).
 */
export async function storeUploadedFile(params: {
  application: ApplicationContext;
  file: File;
  type: DocumentType;
  stage: DocumentStage;
  uploadedById: string;
  /** Optional category prefix for the stored file name (e.g. "HD 1"). */
  namePrefix?: string;
  /** Optional human label for what the document is (shown instead of filename). */
  label?: string | null;
}): Promise<UploadResult> {
  const { file, application, type, stage, uploadedById, namePrefix, label } = params;

  if (!file || typeof file === 'string' || file.size === 0) {
    return { ok: false, error: 'No file provided.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type || 'unknown'}.` };
  }

  // Process + store inside a try/catch so a failure (e.g. the file store /
  // S3 rejecting the write, or image conversion blowing up) returns a clean
  // error to the user instead of throwing an uncaught server exception that
  // crashes the whole page.
  try {
    const original = Buffer.from(await file.arrayBuffer());

    // Verify the real content matches a supported type — don't trust the
    // client-declared MIME (a script/HTML file could claim to be a PDF/image).
    const sniffed = sniffMime(original);
    if (!sniffed || !ALLOWED_MIME_TYPES.includes(sniffed)) {
      return { ok: false, error: 'The file content does not look like a supported document type.' };
    }

    const { bytes, mimeType, converted } = await convertToPdf(original, file.type);
    const isPdf = mimeType === 'application/pdf';

    // Hard block: never store payment-card data. Scan the readable text (text
    // layer, or OCR for scans/photos) BEFORE storing; if a card number is found,
    // reject the upload and keep nothing. Fail-open on a scan error so a hiccup
    // never blocks a legitimate upload.
    try {
      const scanText = await extractTextForScan(bytes, mimeType);
      const card = findCardData(scanText);
      if (card.blocked) {
        await audit({
          actorId: uploadedById,
          action: 'CARD_DATA_BLOCKED',
          entityType: 'Application',
          entityId: application.id,
          detail: `Upload blocked — card data detected (${card.signals.join(', ')})`,
        });
        return { ok: false, error: CARD_BLOCK_MESSAGE };
      }
    } catch (e) {
      console.error('[upload] card-data scan failed (allowing upload)', e);
    }

    const when = new Date();
    const displayName = buildDocumentName({
      firstName: application.applicantFirstName,
      lastName: application.applicantLastName,
      purchaseDate: application.dateOfSale,
      when,
      isPdf,
      originalName: file.name,
      prefix: namePrefix,
    });
    const ext = isPdf ? '.pdf' : displayName.slice(displayName.lastIndexOf('.'));
    const key = newStorageKey({ dealerId: application.dealerId, applicationId: application.id, ext, when });
    await putDocument(key, bytes);

    // Assistive pre-check (page count, dates, e-signature signals). Best-effort:
    // a failure here must never block the upload, so it's caught and dropped.
    let analysis: Prisma.InputJsonValue | undefined;
    let ocrPending = false;
    try {
      const result = await analyzeDocument(bytes, mimeType);
      analysis = result as unknown as Prisma.InputJsonValue;
      // Queue OCR (Tier 2) for anything the text-layer pass couldn't read.
      ocrPending = !!result.scanned;
    } catch (e) {
      console.error('[upload] document pre-check failed (non-blocking)', e);
    }

    const doc = await prisma.document.create({
      data: {
        applicationId: application.id,
        type,
        stage,
        label: label?.trim() || null,
        fileName: displayName,
        originalName: file.name.slice(0, 255),
        mimeType,
        sizeBytes: bytes.length,
        storageKey: key,
        checksum: sha256(bytes),
        uploadedById,
        ocrPending,
        ...(analysis ? { analysis } : {}),
      },
    });

    await audit({
      actorId: uploadedById,
      action: 'DOC_UPLOAD',
      entityType: 'Document',
      entityId: doc.id,
      detail: `${type} (${stage}) for application ${application.id}${converted ? ' [converted to PDF]' : ''}`,
    });

    return { ok: true, documentId: doc.id };
  } catch (err) {
    console.error('[upload] failed to store document', err);
    return { ok: false, error: 'The file could not be saved. Please try again — if it keeps happening, contact GWA.' };
  }
}

/**
 * Store one or more uploaded files (multi-file upload). Returns an error string
 * on failure, plus `storedTypes` — one DocumentType entry per file successfully
 * stored — so callers can tell notifications exactly what was uploaded.
 */
export async function storeFiles(params: {
  application: ApplicationContext;
  files: File[];
  type: DocumentType;
  stage: DocumentStage;
  uploadedById: string;
  namePrefix?: string;
  label?: string | null;
}): Promise<{ error?: string; storedTypes?: DocumentType[] }> {
  const real = params.files.filter((f) => f && typeof f !== 'string' && f.size > 0);
  if (real.length === 0) return { error: 'No file provided.' };

  const storedTypes: DocumentType[] = [];
  for (const file of real) {
    const result = await storeUploadedFile({
      application: params.application,
      file,
      type: params.type,
      stage: params.stage,
      uploadedById: params.uploadedById,
      namePrefix: params.namePrefix,
      label: params.label,
    });
    if (!result.ok) {
      return {
        error: storedTypes.length > 0 ? `${result.error} (${storedTypes.length} uploaded before this)` : result.error,
        storedTypes,
      };
    }
    storedTypes.push(params.type);
  }
  return { storedTypes };
}
