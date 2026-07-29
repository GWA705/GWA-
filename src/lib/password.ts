import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Enforce a reasonable password policy. Returns an error message or null.
 * (Length + character variety; rejects a few obvious weak values.)
 */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters.';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include a symbol.';
  if (/^(password|123456|qwerty)/i.test(pw)) return 'Password is too common.';
  return null;
}

// Passwords must be rotated on this cadence (Phase 4 requirement).
export const PASSWORD_MAX_AGE_DAYS = 90;

/**
 * Whether a password is past its rotation window. A null `changedAt` (e.g. a
 * legacy/seeded account that has never rotated) is treated as expired so the
 * user is prompted to set a fresh password at their next sign-in.
 */
export function isPasswordExpired(changedAt: Date | null | undefined): boolean {
  if (!changedAt) return true;
  const ageMs = Date.now() - changedAt.getTime();
  return ageMs > PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}
