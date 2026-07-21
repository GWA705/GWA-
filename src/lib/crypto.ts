import crypto from 'crypto';

/**
 * Application-level envelope encryption for sensitive fields and documents.
 *
 * Design:
 *  - Each value is encrypted with a fresh random 256-bit data key (DEK) using
 *    AES-256-GCM (authenticated encryption).
 *  - The DEK is wrapped ("enveloped") by a master key (KEK).
 *  - In development the KEK is a local 32-byte key from MASTER_ENCRYPTION_KEY.
 *  - In production, set KMS_KEY_ID so the KEK lives in AWS KMS and the DEK is
 *    wrapped/unwrapped by KMS (the KEK never leaves the HSM boundary).
 *
 * Serialized ciphertext format (all base64url, dot-separated):
 *    v1.<wrappedDek>.<iv>.<authTag>.<ciphertext>
 *
 * This is layered ON TOP OF database-at-rest and S3 SSE-KMS encryption as
 * defense in depth for the most sensitive data (SIN, bank, government ID).
 */

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';

function getLocalMasterKey(): Buffer {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY is not set (and KMS_KEY_ID is not configured). Cannot encrypt/decrypt.',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits).');
  }
  return key;
}

function usingKms(): boolean {
  return !!process.env.KMS_KEY_ID;
}

// --- Local KEK wrap/unwrap (AES-256-GCM key wrapping) ----------------------

function wrapDekLocal(dek: Buffer): Buffer {
  const kek = getLocalMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, kek, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv(12) | tag(16) | wrapped
  return Buffer.concat([iv, tag, wrapped]);
}

function unwrapDekLocal(blob: Buffer): Buffer {
  const kek = getLocalMasterKey();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const wrapped = blob.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

// NOTE: KMS integration point. In production wire these to
// @aws-sdk/client-kms GenerateDataKey / Decrypt using process.env.KMS_KEY_ID.
// The rest of the module is agnostic to how the DEK is wrapped.
function wrapDek(dek: Buffer): Buffer {
  if (usingKms()) {
    throw new Error(
      'KMS wrapping requested but not wired up in this MVP. Set MASTER_ENCRYPTION_KEY for local/staging, ' +
        'or implement KMS GenerateDataKey/Decrypt in src/lib/crypto.ts before enabling KMS_KEY_ID.',
    );
  }
  return wrapDekLocal(dek);
}

function unwrapDek(blob: Buffer): Buffer {
  if (usingKms()) {
    throw new Error('KMS unwrapping not wired up in this MVP. See src/lib/crypto.ts.');
  }
  return unwrapDekLocal(blob);
}

// --- Public API ------------------------------------------------------------

function b64u(buf: Buffer): string {
  return buf.toString('base64url');
}
function fromB64u(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

/** Encrypt a UTF-8 string. Returns a serialized ciphertext token. */
export function encryptString(plaintext: string): string {
  return encryptBuffer(Buffer.from(plaintext, 'utf8'));
}

/** Decrypt a serialized ciphertext token back to a UTF-8 string. */
export function decryptString(token: string): string {
  return decryptBuffer(token).toString('utf8');
}

/** Encrypt arbitrary bytes (e.g. a document). Returns a serialized token. */
export function encryptBuffer(plaintext: Buffer): string {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedDek = wrapDek(dek);
  return [VERSION, b64u(wrappedDek), b64u(iv), b64u(tag), b64u(ciphertext)].join('.');
}

/** Decrypt a serialized token back to bytes. */
export function decryptBuffer(token: string): Buffer {
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== VERSION) {
    throw new Error('Malformed or unsupported ciphertext token.');
  }
  const [, wrappedDekB64, ivB64, tagB64, ctB64] = parts;
  const dek = unwrapDek(fromB64u(wrappedDekB64));
  const iv = fromB64u(ivB64);
  const tag = fromB64u(tagB64);
  const ciphertext = fromB64u(ctB64);
  const decipher = crypto.createDecipheriv(ALGO, dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Convenience: encrypt only when a value is present. */
export function encryptOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return encryptString(value);
}

/** Convenience: decrypt only when a token is present. */
export function decryptOptional(token: string | null | undefined): string | null {
  if (!token) return null;
  return decryptString(token);
}

/** SHA-256 hex digest, used for document integrity checksums. */
export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Mask a value for display (e.g. show only last N chars). Never logs full PII.
 */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  const v = value.replace(/\s+/g, '');
  if (v.length <= visible) return '•'.repeat(v.length);
  return '•••• ' + v.slice(-visible);
}
