import crypto from 'crypto';

/**
 * Single-use password-reset tokens. The raw token is sent only in the emailed
 * link; the database stores just its SHA-256 hash, so a database leak cannot be
 * used to reset accounts.
 */

export const PASSWORD_RESET_TTL_MINUTES = 60;

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
