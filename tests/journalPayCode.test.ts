import { describe, it, expect } from 'vitest';
import { journalPayCode, nonFinancedAmountOf } from '../src/lib/payments';

describe('journalPayCode — "How They Payed" column', () => {
  it('FinanceIt: HD → HDFINIT, GWA → GHSFINIT', () => {
    const base = { paymentMethod: 'FINANCEIT' as const, financeCompanyName: 'FinanceIT', hasFinancedPortion: true };
    expect(journalPayCode({ ...base, programType: 'HD' })).toBe('HDFINIT');
    expect(journalPayCode({ ...base, programType: 'GWA' })).toBe('GHSFINIT');
  });

  it('Enercare and UEI take the program prefix', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: null, financeCompanyName: 'Enercare', hasFinancedPortion: true })).toBe('HDEner');
    expect(journalPayCode({ programType: 'GWA', paymentMethod: null, financeCompanyName: 'Enercare', hasFinancedPortion: true })).toBe('GHSEner');
    expect(journalPayCode({ programType: 'HD', paymentMethod: null, financeCompanyName: 'UEI', hasFinancedPortion: true })).toBe('HDUEI');
    expect(journalPayCode({ programType: 'GWA', paymentMethod: null, financeCompanyName: 'UEI', hasFinancedPortion: true })).toBe('GHSUEI');
  });

  it('card deals are fixed codes: CC → CCHD, HD card → HDCC', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('CCHD');
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'HD_CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('HDCC');
  });

  it('a split finance+card deal takes the finance code (card amount goes in col J)', () => {
    const code = journalPayCode({
      programType: 'HD',
      paymentMethod: null, // split deals have no single method
      financeCompanyName: null,
      splitMethods: ['FINANCEIT', 'CREDIT_CARD'],
      hasFinancedPortion: true,
    });
    expect(code).toBe('HDFINIT');
  });

  it('cash / cheque get no code (null → writer leaves the cell)', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CASH', financeCompanyName: null, hasFinancedPortion: false })).toBeNull();
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CHEQUE', financeCompanyName: null, hasFinancedPortion: false })).toBeNull();
  });
});

describe('nonFinancedAmountOf — Cash/Chq/CC amount (column J)', () => {
  it('split deal: total − financed (a $10,000 deal, $500 card, $9,500 financed → $500)', () => {
    const j = nonFinancedAmountOf({
      isSplitPayment: true,
      financedAmount: 9500,
      requestedAmount: 10000,
      approvedAmount: null,
      paymentMethod: null,
    });
    expect(j).toBe(500);
  });

  it('fully-financed deal → 0', () => {
    const j = nonFinancedAmountOf({
      isSplitPayment: false,
      financedAmount: null,
      requestedAmount: 8000,
      approvedAmount: 8000,
      paymentMethod: 'FINANCEIT',
    });
    expect(j).toBe(0);
  });

  it('fully card-paid deal → the whole amount', () => {
    const j = nonFinancedAmountOf({
      isSplitPayment: false,
      financedAmount: null,
      requestedAmount: 3200,
      approvedAmount: null,
      paymentMethod: 'CREDIT_CARD',
    });
    expect(j).toBe(3200);
  });
});
