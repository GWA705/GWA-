import type { DocumentStage, DocumentType } from '@prisma/client';
import { prisma } from './db';
import { putDocument, newStorageKey } from './storage';
import { sha256 } from './crypto';
import { audit } from './audit';
import { MAX_FILE_BYTES, ALLOWED_MIME_TYPES } from './constants';

export interface UploadResult {
  ok: boolean;
  error?: string;
  documentId?: string;
}

/**
 * Validate and store an uploaded file for an application. Bytes are
 * application-encrypted at rest by the storage layer. Caller is responsible
 * for authorization (that this user may write to this application).
 */
export async function storeUploadedFile(params: {
  applicationId: string;
  file: File;
  type: DocumentType;
  stage: DocumentStage;
  uploadedById: string;
}): Promise<UploadResult> {
  const { file, applicationId, type, stage, uploadedById } = params;

  if (!file || typeof file === 'string' || file.size === 0) {
    return { ok: false, error: 'No file provided.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit.` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type || 'unknown'}.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = newStorageKey(applicationId, file.name);
  await putDocument(key, bytes);

  const doc = await prisma.document.create({
    data: {
      applicationId,
      type,
      stage,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      sizeBytes: file.size,
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
    detail: `${type} (${stage}) for application ${applicationId}`,
  });

  return { ok: true, documentId: doc.id };
}
