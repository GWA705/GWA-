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

/** Generate a random, unguessable storage key under an application prefix. */
export function newStorageKey(applicationId: string, fileName: string): string {
  const ext = path.extname(fileName).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, '');
  const rand = crypto.randomBytes(16).toString('hex');
  return `applications/${applicationId}/${rand}${ext}`;
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

async function s3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({ region: process.env.S3_REGION || 'ca-central-1' });
}

function s3Bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error('S3_BUCKET is not set.');
  return b;
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
      // Additional at-rest encryption managed by AWS KMS.
      ServerSideEncryption: 'aws:kms',
      ContentType: 'application/octet-stream',
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
