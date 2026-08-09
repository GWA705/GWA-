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
  it('blocks the HD Consumer Credit card (6035 2944 prefix), always', () => {
    expect(findCardData('Account Number 6035 2944 5186 4487').blocked).toBe(true);
    expect(findCardData('6035 2944 0000 0000').blocked).toBe(true); // even if Luhn-invalid
  });
  it('blocks the FinanceIT one-time-use card (4356 0121 prefix), always', () => {
    expect(findCardData('ACCOUNT NUMBER 4356 0121 4750 9993').blocked).toBe(true);
    expect(findCardData('4356 0121 0000 0000').blocked).toBe(true); // even if Luhn-invalid
  });
  it('blocks a store/private card in clear card context (not a major brand)', () => {
    const doc =
      'Name: Omer M Sagbo  Credit Limit: $3,000  Account Number: 6039 2944 5186 4483  Purchase APR: 28.80%  Temporary Security Code: 417';
    expect(findCardData(doc).blocked).toBe(true);
  });
  it('does NOT block a lone non-brand 16-digit number with no card context', () => {
    // No major-brand prefix, no surrounding card words → not treated as a card.
    expect(findCardData('Batch id 8888 8888 8888 8887').blocked).toBe(false);
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
