import { describe, it, expect } from 'vitest';
import { isPasswordExpired, PASSWORD_MAX_AGE_DAYS } from '@/lib/password';
import { generateResetToken, hashResetToken } from '@/lib/tokens';
import { contentSlugToSection } from '@/lib/constants';

const DAY = 24 * 60 * 60 * 1000;

describe('password expiry policy', () => {
  it('treats a never-set password as expired', () => {
    expect(isPasswordExpired(null)).toBe(true);
    expect(isPasswordExpired(undefined)).toBe(true);
  });

  it('accepts a recently changed password', () => {
    expect(isPasswordExpired(new Date(Date.now() - 1 * DAY))).toBe(false);
  });

  it('expires a password older than the max age', () => {
    expect(isPasswordExpired(new Date(Date.now() - (PASSWORD_MAX_AGE_DAYS + 1) * DAY))).toBe(true);
  });
});

describe('password reset tokens', () => {
  it('hashes deterministically and never stores the raw token', () => {
    const { token, tokenHash } = generateResetToken();
    expect(token).not.toEqual(tokenHash);
    expect(hashResetToken(token)).toEqual(tokenHash);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a unique token each call', () => {
    expect(generateResetToken().token).not.toEqual(generateResetToken().token);
  });
});

describe('content section slugs', () => {
  it('maps known slugs to sections', () => {
    expect(contentSlugToSection('resources')).toBe('RESOURCE');
    expect(contentSlugToSection('hd-promotions')).toBe('HD_PROMOTION');
    expect(contentSlugToSection('hd-credit-card')).toBe('HD_CREDIT_CARD');
  });

  it('returns null for an unknown slug', () => {
    expect(contentSlugToSection('nope')).toBeNull();
  });
});
