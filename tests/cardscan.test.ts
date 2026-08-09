import { describe, it, expect } from 'vitest';
import { luhnValid, cardBrand, findCardData } from '@/lib/cardscan';

describe('luhnValid', () => {
  it('accepts a valid card number and rejects a tampered one', () => {
    expect(luhnValid('4111111111111111')).toBe(true); // Visa test number
    expect(luhnValid('4111111111111112')).toBe(false);
  });
});

describe('cardBrand', () => {
  it('identifies brands from prefix + length', () => {
    expect(cardBrand('4111111111111111')).toBe('Visa');
    expect(cardBrand('5555555555554444')).toBe('Mastercard');
    expect(cardBrand('378282246310005')).toBe('Amex');
    expect(cardBrand('6011111111111117')).toBe('Discover');
  });
  it('returns null for non-card numbers', () => {
    expect(cardBrand('123456789')).toBeNull(); // SIN-length
    expect(cardBrand('7014567890')).toBeNull(); // HD-style
  });
});

describe('findCardData (hard block)', () => {
  it('blocks a bare card number', () => {
    expect(findCardData('4111111111111111').blocked).toBe(true);
  });
  it('blocks a card number with spaces or dashes', () => {
    expect(findCardData('card 4111 1111 1111 1111 exp').blocked).toBe(true);
    expect(findCardData('4111-1111-1111-1111').blocked).toBe(true);
  });
  it('blocks Amex/MC/Discover test numbers', () => {
    expect(findCardData('3782 822463 10005').blocked).toBe(true);
    expect(findCardData('5555 5555 5555 4444').blocked).toBe(true);
  });
  it('does NOT block a SIN, phone, HD #, or loan number', () => {
    expect(findCardData('SIN 123 456 782').blocked).toBe(false);
    expect(findCardData('call 705-812-0320').blocked).toBe(false);
    expect(findCardData('HD Customer # 800123456').blocked).toBe(false);
    expect(findCardData('Financing deal number 7785342').blocked).toBe(false);
  });
  it('does NOT block a 16-digit number that fails Luhn', () => {
    expect(findCardData('1234 5678 9012 3456').blocked).toBe(false);
  });
  it('records corroborating signals without leaking digits', () => {
    const r = findCardData('VISA 4111 1111 1111 1111 exp 08/27 CVV 123');
    expect(r.blocked).toBe(true);
    expect(r.signals.join(' ')).toContain('pan:Visa');
    expect(r.signals).toContain('brand-word');
    expect(r.signals).toContain('expiry');
    expect(r.signals.join(' ')).not.toMatch(/4111/);
  });
});
