import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encryptString, decryptString } from './crypto';

// Allow one step of drift on either side (30s window each).
authenticator.options = { window: 1 };

const ISSUER = 'GWA Credit Portal';

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
