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
}): Promise<UploadResult> {
  const { file, application, type, stage, uploadedById } = params;

  if (!file || typeof file === 'string' || file.size === 0) {
    return { ok: false, error: 'No file provided.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type || 'unknown'}.` };
  }

  const original = Buffer.from(await file.arrayBuffer());
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
}
