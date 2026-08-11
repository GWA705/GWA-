import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include a symbol.';
  if (/^(password|123456|qwerty)/i.test(pw)) return 'Password is too common.';
  return null;
}

/**
 * Generate a strong temporary password that satisfies validatePasswordStrength.
 * Used when an admin approves a dealer's user request — the new user must change
 * it at first sign-in (passwordChangedAt is left null). Avoids ambiguous glyphs.
 */
export function generateTempPassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  // Fisher–Yates shuffle so the guaranteed classes aren't always in front.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
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
