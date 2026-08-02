import type { DocumentStage, DocumentType } from '@prisma/client';
import { prisma } from './db';
import { putDocument, newStorageKey } from './storage';
import { sha256 } from './crypto';
import { audit } from './audit';
import { convertToPdf, buildDocumentName } from './pdf';
import { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from './constants';

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
}): Promise<UploadResult> {
  const { file, application, type, stage, uploadedById, namePrefix } = params;

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

    const doc = await prisma.document.create({
      data: {
        applicationId: application.id,
        type,
        stage,
        fileName: displayName,
        originalName: file.name.slice(0, 255),
        mimeType,
        sizeBytes: bytes.length,
        storageKey: key,
        checksum: sha256(bytes),
        uploadedById,
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
