import { describe, it, expect } from 'vitest';
import {
  encryptString,
  decryptString,
  encryptBuffer,
  decryptBuffer,
  encryptOptional,
  decryptOptional,
  sha256,
  maskTail,
} from '@/lib/crypto';

describe('field encryption', () => {
  it('round-trips a string', () => {
    const plain = '123 456 789';
    const token = encryptString(plain);
    expect(token).not.toContain(plain);
    expect(token.startsWith('v1.')).toBe(true);
    expect(decryptString(token)).toBe(plain);
  });

  it('produces different ciphertext each time (random DEK + IV)', () => {
    const a = encryptString('same');
    const b = encryptString('same');
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe('same');
    expect(decryptString(b)).toBe('same');
  });

  it('round-trips binary data (documents)', () => {
    const buf = Buffer.from([0, 1, 2, 253, 254, 255, 10, 42]);
    const token = encryptBuffer(buf);
    expect(decryptBuffer(token).equals(buf)).toBe(true);
  });

  it('fails to decrypt tampered ciphertext (GCM auth)', () => {
    const token = encryptString('secret');
    const parts = token.split('.');
    // Flip a character in the ciphertext segment.
    const ct = parts[4];
    parts[4] = ct.slice(0, -1) + (ct.endsWith('A') ? 'B' : 'A');
    expect(() => decryptString(parts.join('.'))).toThrow();
  });

  it('handles optional helpers', () => {
    expect(encryptOptional('')).toBeNull();
    expect(encryptOptional(null)).toBeNull();
    expect(decryptOptional(null)).toBeNull();
    const t = encryptOptional('x');
    expect(decryptOptional(t)).toBe('x');
  });

  it('computes stable sha-256', () => {
    expect(sha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('masks values without leaking the full secret', () => {
    expect(maskTail('123456789', 3)).toBe('•••• 789');
    expect(maskTail(null)).toBe('—');
  });

  it('works with an arbitrary platform-generated secret (derived key)', () => {
    const original = process.env.MASTER_ENCRYPTION_KEY;
    // A random string that does NOT decode to exactly 32 bytes → key is derived.
    process.env.MASTER_ENCRYPTION_KEY = 'render-style-auto-generated-secret-abc123XYZ';
    try {
      const token = encryptString('sensitive');
      expect(decryptString(token)).toBe('sensitive');
    } finally {
      process.env.MASTER_ENCRYPTION_KEY = original;
    }
  });
});
