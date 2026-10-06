import { describe, it, expect } from 'vitest';
import { normalizeCallPhone } from '@/lib/customerCalls';

describe('normalizeCallPhone', () => {
  it('reduces common formats to the same 10 digits', () => {
    const want = '7055550148';
    expect(normalizeCallPhone('(705) 555-0148')).toBe(want);
    expect(normalizeCallPhone('705-555-0148')).toBe(want);
    expect(normalizeCallPhone('705.555.0148')).toBe(want);
    expect(normalizeCallPhone('+1 705 555 0148')).toBe(want); // drops the country digit
    expect(normalizeCallPhone(' 7055550148 ')).toBe(want);
  });

  it('handles empty / unknown values', () => {
    expect(normalizeCallPhone(null)).toBe('');
    expect(normalizeCallPhone(undefined)).toBe('');
    expect(normalizeCallPhone('')).toBe('');
    expect(normalizeCallPhone('n/a')).toBe('');
  });

  it('keeps short numbers as-is (no 10-digit truncation)', () => {
    expect(normalizeCallPhone('5550148')).toBe('5550148');
  });
});
