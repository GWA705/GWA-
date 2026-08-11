import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePasswordStrength, generateTempPassword } from '@/lib/password';

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('CorrectHorse!23');
    expect(hash).not.toContain('CorrectHorse');
    expect(await verifyPassword('CorrectHorse!23', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('always satisfies the strength policy', () => {
    for (let i = 0; i < 200; i += 1) {
      const pw = generateTempPassword();
      expect(pw.length).toBeGreaterThanOrEqual(12);
      expect(validatePasswordStrength(pw)).toBeNull();
    }
  });
  it('is not predictable (no two the same)', () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    expect(set.size).toBe(50);
  });
});

describe('password strength policy', () => {
  it('rejects weak passwords', () => {
    expect(validatePasswordStrength('short')).toBeTruthy();
    expect(validatePasswordStrength('alllowercase1!')).toBeTruthy();
    expect(validatePasswordStrength('NOLOWERCASE1!')).toBeTruthy();
    expect(validatePasswordStrength('NoNumber!!aa')).toBeTruthy();
    expect(validatePasswordStrength('NoSymbol1234')).toBeTruthy();
    expect(validatePasswordStrength('password1234!A')).toBeTruthy();
  });

  it('accepts a strong password', () => {
    expect(validatePasswordStrength('Str0ng&Secure!')).toBeNull();
  });
});
