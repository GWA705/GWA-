import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encryptString, decryptString, sha256 } from './crypto';

// --- Email one-time codes (EMAIL method) ----------------------------------
// 30 min: forgiving of slow email delivery (a newly-configured SMTP sender can
// be greylisted / deferred for several minutes). The code is single-use,
// rate-limited, and the account locks after repeated failures, so a longer
// window doesn't meaningfully weaken it.
export const EMAIL_CODE_TTL_MINUTES = 30;

/** A 6-digit numeric login code. */
export function generateEmailCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Hash for storage (never store the raw code). */
export function hashEmailCode(code: string): string {
  return sha256(Buffer.from(code.replace(/\s+/g, '')));
}

export function emailCodeMatches(input: string, storedHash: string | null, expiresAt: Date | null): boolean {
  if (!storedHash || !expiresAt) return false;
  if (expiresAt.getTime() < Date.now()) return false;
  return hashEmailCode(input) === storedHash;
}

// Allow one step of drift on either side (30s window each).
authenticator.options = { window: 1 };

const ISSUER = 'GWA Dealer Portal';

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/** Encrypt the TOTP secret for storage. */
export function encryptMfaSecret(secret: string): string {
  return encryptString(secret);
}

export function decryptMfaSecret(enc: string): string {
  return decryptString(enc);
}

export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ''), secret });
  } catch {
    return false;
  }
}

/** Build the otpauth:// URI and a data-URL QR code for enrollment. */
export async function buildMfaEnrollment(
  accountEmail: string,
  secret: string,
): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
  const otpauthUrl = authenticator.keyuri(accountEmail, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { otpauthUrl, qrDataUrl };
}
