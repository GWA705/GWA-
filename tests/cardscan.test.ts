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
    expect(findCardData('6011 1111 1111 1117').blocked).toBe(true); // Discover — not eaten by the phone scrub
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
  it('does NOT block two phone numbers written back-to-back (647 area code)', () => {
    // The real false positive: two 647-area-code numbers merged by OCR into a
    // 19-digit run that looks like a Discover card (644–649 prefix range).
    expect(findCardData('647 568 6547, 647 677 9338').blocked).toBe(false);
    expect(findCardData('Phone: 647 568 6547 647 677 9338').blocked).toBe(false);
    expect(findCardData('(647) 568-6547 / (647) 677-9338').blocked).toBe(false);
    // OCR strips every space → one 20-digit run with no separators at all.
    expect(findCardData('Phone 64756865476476779338').blocked).toBe(false);
    expect(findCardData('647568654764 76779338').blocked).toBe(false);
  });
  it('does NOT block merged phones for other Ontario area codes overlapping BINs', () => {
    expect(findCardData('4165551234 4165559876').blocked).toBe(false); // 416 ↔ Visa
    expect(findCardData('5195551234 5195559876').blocked).toBe(false); // 519 ↔ Mastercard
    expect(findCardData('3435551234 3435559876').blocked).toBe(false); // 343 ↔ Amex
  });
  it('still blocks a real card even when phone numbers share the document', () => {
    const doc = 'Phone 647 568 6547 647 677 9338  Card 4111 1111 1111 1111';
    expect(findCardData(doc).blocked).toBe(true);
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

describe('void cheque / PAP is not a card (banking context)', () => {
  // OCR of the RBC void-cheque letter that was wrongly blocked: the three
  // banking numbers run together into a Luhn-valid 15-digit string sitting next
  // to "Account Number".
  const chequeOcr =
    'Royal Bank RBC DARCY JAMES CULSHAW Re: Void Cheque ' +
    "Please accept this copy of a void cheque as confirmation of the bank account information for the purposes of pre-authorized debit or credit. " +
    'VOID Transit Number Institution Number Account Number 02869 003 5019849';

  it('does NOT block a void cheque with only banking context', () => {
    expect(findCardData(chequeOcr).blocked).toBe(false);
  });
  it('does NOT block a bare PAP form account number run', () => {
    expect(findCardData('Pre-authorized debit form. Institution Number Transit Number Account Number 02869 003 5019849').blocked).toBe(false);
  });

  // The exemption must NOT let real cards through.
  it('still blocks a real Visa even if the word "void" appears', () => {
    expect(findCardData('VOID sample — Visa 4111 1111 1111 1111').blocked).toBe(true);
  });
  it('still blocks the HD Consumer card by prefix on a banking-looking doc', () => {
    expect(findCardData('void cheque account number 6035294400000000').blocked).toBe(true);
  });
  it('still blocks the FinanceIT one-time card by prefix', () => {
    expect(findCardData('pre-authorized 4356012100000000').blocked).toBe(true);
  });
  it('still blocks a card statement that says "account number" but has a card signal', () => {
    // A real statement carries a card signal (CVV / expiry / cardholder / brand),
    // which cancels the banking exemption.
    expect(findCardData('Cardholder DARCY CULSHAW Account Number 02869 003 5019849 CVV 123').blocked).toBe(true);
  });
});
