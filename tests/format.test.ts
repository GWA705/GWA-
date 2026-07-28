import { describe, it, expect } from 'vitest';
import { formatPhone, formatPostal, formatSin } from '@/lib/format';

describe('input formatting', () => {
  it('formats phone as 705-716-2111', () => {
    expect(formatPhone('7057162111')).toBe('705-716-2111');
    expect(formatPhone('705')).toBe('705');
    expect(formatPhone('705716')).toBe('705-716');
    expect(formatPhone('(705) 716-2111')).toBe('705-716-2111');
    expect(formatPhone('70571621119999')).toBe('705-716-2111'); // capped at 10 digits
  });

  it('formats postal code as L0L 2T0', () => {
    expect(formatPostal('l0l2t0')).toBe('L0L 2T0');
    expect(formatPostal('L0L')).toBe('L0L');
    expect(formatPostal('L0L 2T0')).toBe('L0L 2T0');
  });

  it('formats SIN as 000 000 000', () => {
    expect(formatSin('123456789')).toBe('123 456 789');
    expect(formatSin('123')).toBe('123');
    expect(formatSin('12345')).toBe('123 45');
  });
});
