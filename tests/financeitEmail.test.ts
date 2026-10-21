import { describe, it, expect } from 'vitest';
import {
  parseFinanceitEmail,
  lifecycleFromSubject,
  last10,
  fieldScore,
} from '../src/lib/financeitEmailParse';

// Real bodies captured from partners@financeit.io (names/numbers are live-format
// examples). These lock in the field extraction against the actual email shapes.

const PRE_QUALIFIED = `Hello,

Gabriel Gour's application is pre-qualified. Their current credit limit is set to $10,000.00.

Gabriel Gour can borrow up to $50,000.00

Customer name: Gabriel Gour

Loan number: 7848709

Phone number: 2892410375

Email address: gabgour@gmail.com

Application source: (HD) Georgian Health and Safety LTD.

Employee: SANDRA BATCHELOR

Purchase amount: $1,000.00

Purchase type: Water Treatment, Water Filtration / Purification

Credit limit: $10,000.00

Program: 8.99% Interest for 60 Months

APR: 8.99%

Interest rate: 8.99%

Monthly payment amount: $10.13

Expiry date: April 18, 2027

View loan ( https://www.financeit.ca/en/partner/loans/7848709 )

Thank you,

The Financeit Team

Contact Us:

T 1-888-536-3025
Email: partners@financeit.io`;

const FINALIZED = `Hello,

TOM's loan is now finalized

Loan 7776737 was funded and is now finalized.

Loan number: 7776737

Customer name: TOM DOBSON

Purchase amount: $3,387.74

Program: 8.99% Interest for 60 Months

APR: 8.99%

Interest rate:8.99%

Monthly payment amount:$34.34`;

const CONDITIONS = `Hello,

The following approval conditions were cleared:

* Financeit Review

Customer name: Azarakhsh Yazdani
Loan number: 7845056
Purchase amount: $6,322.35
Expiry date: April 13, 2027
Credit limit: $20,000.00`;

describe('parseFinanceitEmail — pre-qualified (the rich one)', () => {
  const d = parseFinanceitEmail('m1', "Gabriel Gour's application is pre-qualified", null, PRE_QUALIFIED);

  it('extracts the loan number, contact and financing terms', () => {
    expect(d.lifecycle).toBe('PRE_QUALIFIED');
    expect(d.loanNumber).toBe('7848709');
    expect(d.customerName).toBe('Gabriel Gour');
    expect(d.phone).toBe('2892410375');
    expect(d.email).toBe('gabgour@gmail.com');
    expect(d.employee).toBe('SANDRA BATCHELOR');
    expect(d.applicationSource).toBe('(HD) Georgian Health and Safety LTD.');
    expect(d.purchaseAmount).toBe(1000);
    expect(d.purchaseType).toBe('Water Treatment, Water Filtration / Purification');
    expect(d.creditLimit).toBe(10000);
    expect(d.monthlyPayment).toBe(10.13);
    expect(d.termMonths).toBe(60); // parsed out of "...for 60 Months"
    expect(d.expiryDate?.getFullYear()).toBe(2027);
  });

  it("the footer's 'Email:' never clobbers the customer 'Email address:'", () => {
    expect(d.email).toBe('gabgour@gmail.com'); // not partners@financeit.io
  });
});

describe('parseFinanceitEmail — finalized (funded), colons with no space', () => {
  const d = parseFinanceitEmail('m2', 'Loan 7776737: TOM DOBSON’s loan is now finalized', null, FINALIZED);

  it('reads the funded loan even when "Monthly payment amount:$34.34" has no space', () => {
    expect(d.lifecycle).toBe('FINALIZED');
    expect(d.loanNumber).toBe('7776737');
    expect(d.customerName).toBe('TOM DOBSON');
    expect(d.purchaseAmount).toBe(3387.74);
    expect(d.monthlyPayment).toBe(34.34);
    expect(d.termMonths).toBe(60);
    // Fields this email type doesn't carry come back null, not wrong.
    expect(d.email).toBeNull();
    expect(d.phone).toBeNull();
  });
});

describe('parseFinanceitEmail — conditions cleared (sparse)', () => {
  const d = parseFinanceitEmail('m3', 'Loan 7845056: All approval conditions cleared', null, CONDITIONS);
  it('still pulls loan number, amount, credit limit, expiry', () => {
    expect(d.lifecycle).toBe('CONDITIONS_CLEARED');
    expect(d.loanNumber).toBe('7845056');
    expect(d.purchaseAmount).toBe(6322.35);
    expect(d.creditLimit).toBe(20000);
    expect(d.expiryDate?.getFullYear()).toBe(2027);
  });
});

describe('lifecycleFromSubject', () => {
  it('maps each subject form to its stage', () => {
    expect(lifecycleFromSubject("X's application is pre-qualified")).toBe('PRE_QUALIFIED');
    expect(lifecycleFromSubject("X's application is pre-qualified on our Extended Credit program")).toBe('PRE_QUALIFIED');
    expect(lifecycleFromSubject('Loan 1: X’s loan is now finalized')).toBe('FINALIZED');
    expect(lifecycleFromSubject('Loan 1: X authorized the release of funds')).toBe('AUTHORIZED');
    expect(lifecycleFromSubject('Loan 1: Ready to request funds')).toBe('READY_TO_FUND');
    expect(lifecycleFromSubject('Loan 1: Get payment card details')).toBe('CARD_DETAILS');
    expect(lifecycleFromSubject('Try to get X’s application approved')).toBe('DECLINED');
    expect(lifecycleFromSubject('Loan 1: Affordability - Action required')).toBe('DECLINED');
  });
});

describe('matching helpers', () => {
  it('last10 normalizes phones to the last 10 digits', () => {
    expect(last10('(289) 241-0375')).toBe('2892410375');
    expect(last10('+1 289 241 0375')).toBe('2892410375');
    expect(last10(null)).toBeNull();
  });

  it('fieldScore ranks the pre-qualified email above the sparse one', () => {
    const rich = parseFinanceitEmail('a', "X's application is pre-qualified", null, PRE_QUALIFIED);
    const sparse = parseFinanceitEmail('b', 'Loan 1: All approval conditions cleared', null, CONDITIONS);
    expect(fieldScore(rich)).toBeGreaterThan(fieldScore(sparse));
  });
});
