import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { encryptBuffer, decryptBuffer } from './crypto';

/**
 * Document storage abstraction.
 *
 * File bytes are ALWAYS application-encrypted (envelope encryption) before they
 * touch the storage backend, and documents are only ever served through an
 * authenticated Next.js route — there are no public URLs to plaintext.
 *
 *  - STORAGE_DRIVER=local : encrypted blobs on local disk (development).
 *  - STORAGE_DRIVER=s3    : encrypted blobs in S3 (production, ca-central-1),
 *                           with S3 SSE-KMS as an additional at-rest layer.
 */

export interface StoredObject {
  key: string;
  sizeBytes: number;
}

function driver(): 'local' | 's3' {
  return (process.env.STORAGE_DRIVER as 'local' | 's3') || 'local';
}

/**
 * Generate a random, unguessable storage key, organized by dealer and date:
 *   dealers/<dealerId>/<YYYY>/<MM>/week-<n>/<applicationId>/<rand><ext>
 * The date hierarchy uses the upload time.
 */
export function newStorageKey(params: {
  dealerId: string;
  applicationId: string;
  ext: string;
  when: Date;
}): string {
  const { dealerId, applicationId, when } = params;
  const ext = params.ext.replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  const week = Math.ceil(when.getUTCDate() / 7); // week of the month (1–5)
  const rand = crypto.randomBytes(16).toString('hex');
  return `dealers/${dealerId}/${year}/${month}/week-${week}/${applicationId}/${rand}${ext}`;
}

// --- Local driver ----------------------------------------------------------

function localRoot(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR || './storage');
}

function localPath(key: string): string {
  const root = localRoot();
  const full = path.resolve(root, key);
  // Prevent path traversal.
  if (!full.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key.');
  }
  return full;
}

async function localPut(key: string, plaintext: Buffer): Promise<void> {
  const full = localPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const token = encryptBuffer(plaintext);
  await fs.writeFile(full, token, 'utf8');
}

async function localGet(key: string): Promise<Buffer> {
  const token = await fs.readFile(localPath(key), 'utf8');
  return decryptBuffer(token);
}

async function localDelete(key: string): Promise<void> {
  await fs.rm(localPath(key), { force: true });
}

// --- S3 driver -------------------------------------------------------------
//
// Works with AWS S3 (recommended: ca-central-1 for Canadian data residency)
// and any S3-compatible service (Cloudflare R2, MinIO) via S3_ENDPOINT.
// Credentials come from the standard AWS chain — on a host without an IAM role
// (e.g. Vercel), set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _s3: any = null;

async function s3Client() {
  if (_s3) return _s3;
  const { S3Client } = await import('@aws-sdk/client-s3');
  const endpoint = process.env.S3_ENDPOINT || undefined;
  _s3 = new S3Client({
    region: process.env.S3_REGION || 'ca-central-1',
    // Custom endpoint (R2 / MinIO / tests). Path-style is required by most
    // S3-compatible servers and by localhost testing.
    ...(endpoint ? { endpoint, forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false' } : {}),
  });
  return _s3;
}

function s3Bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error('S3_BUCKET is not set.');
  return b;
}

// Server-side encryption on the bucket. The file bytes are ALREADY
// application-encrypted before upload, so this is defense-in-depth. Defaults to
// SSE-S3 (AES256), which needs no extra setup; set S3_SSE=aws:kms (with optional
// S3_KMS_KEY_ID) for KMS, or S3_SSE=none to rely on the bucket's default.
function s3Sse(): Record<string, string> {
  const sse = (process.env.S3_SSE || 'AES256').toLowerCase();
  if (sse === 'none') return {};
  if (sse === 'aws:kms' || sse === 'kms') {
    return {
      ServerSideEncryption: 'aws:kms',
      ...(process.env.S3_KMS_KEY_ID ? { SSEKMSKeyId: process.env.S3_KMS_KEY_ID } : {}),
    };
  }
  return { ServerSideEncryption: 'AES256' };
}

async function s3Put(key: string, plaintext: Buffer): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  const token = Buffer.from(encryptBuffer(plaintext), 'utf8');
  await client.send(
    new PutObjectCommand({
      Bucket: s3Bucket(),
      Key: key,
      Body: token,
      ContentType: 'application/octet-stream',
      ...s3Sse(),
    }),
  );
}

async function s3Get(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  const res = await client.send(new GetObjectCommand({ Bucket: s3Bucket(), Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return decryptBuffer(Buffer.from(bytes).toString('utf8'));
}

async function s3Delete(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = await s3Client();
  await client.send(new DeleteObjectCommand({ Bucket: s3Bucket(), Key: key }));
}

// --- Public API ------------------------------------------------------------

export async function putDocument(key: string, plaintext: Buffer): Promise<StoredObject> {
  if (driver() === 's3') await s3Put(key, plaintext);
  else await localPut(key, plaintext);
  return { key, sizeBytes: plaintext.length };
}

export async function getDocument(key: string): Promise<Buffer> {
  return driver() === 's3' ? s3Get(key) : localGet(key);
}

export async function deleteDocument(key: string): Promise<void> {
  return driver() === 's3' ? s3Delete(key) : localDelete(key);
}
