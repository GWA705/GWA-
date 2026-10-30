import { describe, it, expect } from 'vitest';
import { journalPayCode, nonFinancedAmountOf, dealHasCardPayment, dealPaysHomeDepot } from '../src/lib/payments';

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

  it('credit-card codes: HD deal → CCHD, GWA deal → CC, HD card → HDCC', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('CCHD');
    // A personal credit card on a Georgian Water (non-HD) deal is plain CC.
    expect(journalPayCode({ programType: 'GWA', paymentMethod: 'CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('CC');
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'HD_CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('HDCC');
    // HDCC is a Home Depot card regardless of program prefix.
    expect(journalPayCode({ programType: 'GWA', paymentMethod: 'HD_CREDIT_CARD', financeCompanyName: null, hasFinancedPortion: false })).toBe('HDCC');
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

  it('every non-financed method reflects the chosen payment option', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CASH', financeCompanyName: null, hasFinancedPortion: false })).toBe('Cash');
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'CHEQUE', financeCompanyName: null, hasFinancedPortion: false })).toBe('Cheque');
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'E_TRANSFER', financeCompanyName: null, hasFinancedPortion: false })).toBe('E-Transfer');
  });

  it('a different finance company puts its name in the journal', () => {
    expect(journalPayCode({ programType: 'HD', paymentMethod: 'FINANCE_COMPANY', financeCompanyName: 'Fairstone', hasFinancedPortion: true })).toBe('Fairstone');
    expect(journalPayCode({ programType: 'GWA', paymentMethod: 'FINANCE_COMPANY', financeCompanyName: 'Snap Financial', hasFinancedPortion: true })).toBe('Snap Financial');
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

describe('dealHasCardPayment — when the reviewer tracks a card', () => {
  it('true for a credit-card or HDCC deal, false for cash/financed', () => {
    expect(dealHasCardPayment({ isSplitPayment: false, paymentMethod: 'CREDIT_CARD' })).toBe(true);
    expect(dealHasCardPayment({ isSplitPayment: false, paymentMethod: 'HD_CREDIT_CARD' })).toBe(true);
    expect(dealHasCardPayment({ isSplitPayment: false, paymentMethod: 'CASH' })).toBe(false);
    expect(dealHasCardPayment({ isSplitPayment: false, paymentMethod: 'FINANCEIT' })).toBe(false);
    expect(dealHasCardPayment({ isSplitPayment: false, paymentMethod: null })).toBe(false);
  });
  it('true for a split deal with a card line (the deposit)', () => {
    expect(dealHasCardPayment({ isSplitPayment: true, paymentMethod: null, splitMethods: ['FINANCEIT', 'CREDIT_CARD'] })).toBe(true);
    expect(dealHasCardPayment({ isSplitPayment: true, paymentMethod: null, splitMethods: ['FINANCEIT', 'CASH'] })).toBe(false);
  });
});

describe('dealPaysHomeDepot — office pays HD only for HD Enercare/UEI', () => {
  it('true for HD Enercare / UEI deals', () => {
    expect(dealPaysHomeDepot({ programType: 'HD', financeCompanyName: 'Enercare' })).toBe(true);
    expect(dealPaysHomeDepot({ programType: 'HD', financeCompanyName: 'UEI' })).toBe(true);
  });
  it('false for HD FinanceIt/card deals and for every GWA deal', () => {
    expect(dealPaysHomeDepot({ programType: 'HD', financeCompanyName: 'FinanceIT' })).toBe(false);
    expect(dealPaysHomeDepot({ programType: 'HD', financeCompanyName: null })).toBe(false);
    // A GWA Enercare deal (GHSEner) does not pay Home Depot.
    expect(dealPaysHomeDepot({ programType: 'GWA', financeCompanyName: 'Enercare' })).toBe(false);
  });
});
