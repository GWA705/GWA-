import { describe, it, expect } from 'vitest';
import { looksLikeCardNumber, luhnValid, redactCardNumbers, CARD_REDACTION } from '../src/lib/cardGuard';

describe('luhnValid', () => {
  it('accepts a valid card number and rejects a bad one', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242424242424243')).toBe(false);
  });
});

describe('looksLikeCardNumber', () => {
  it('blocks real card numbers (spaces, dashes, Amex 15)', () => {
    expect(looksLikeCardNumber('my card is 4242 4242 4242 4242')).toBe(true);
    expect(looksLikeCardNumber('4111-1111-1111-1111')).toBe(true);
    expect(looksLikeCardNumber('378282246310005')).toBe(true); // Amex, 15 digits
  });

  it('does NOT block the portal’s own reference numbers', () => {
    expect(looksLikeCardNumber('HD Customer # 800251798')).toBe(false); // 9 digits
    expect(looksLikeCardNumber('financing deal 7810696')).toBe(false); // 7 digits
    expect(looksLikeCardNumber('call me at 705-555-0123')).toBe(false); // phone
    expect(looksLikeCardNumber('serial ABC123456789')).toBe(false); // < 13 digits
    expect(looksLikeCardNumber('1111 1111 1111 1111')).toBe(false); // 16 digits but fails Luhn
  });

  it('ignores ordinary text', () => {
    expect(looksLikeCardNumber('Approved — sending paperwork today')).toBe(false);
  });
});

describe('redactCardNumbers', () => {
  it('strips card numbers but keeps the rest of the message', () => {
    expect(redactCardNumbers('here it is 4242 4242 4242 4242 thanks')).toBe(`here it is ${CARD_REDACTION} thanks`);
    expect(redactCardNumbers('amex 378282246310005')).toBe(`amex ${CARD_REDACTION}`);
  });

  it('leaves portal reference numbers untouched', () => {
    expect(redactCardNumbers('HD 800251798, financing 7810696, call 705-555-0123')).toBe(
      'HD 800251798, financing 7810696, call 705-555-0123',
    );
  });
});
