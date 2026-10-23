import { describe, it, expect } from 'vitest';
import { buildColumnMap } from '../src/lib/reporting/journalRead';

/**
 * Column-mapping for the sales journals, with the 2024 book's wide two-row header
 * as the key case. The 2024 "November 2024" tab has SIX columns after Result whose
 * header contains "paid" — the dealer's and manager's commission payout dates, two
 * Amex columns, the finance "Amt. Paid By" money column, and finally the real
 * funding "Date Paid" next to "Balance Of Sale". The reader must lock onto the
 * funding one; a plain nearest-"paid" rule used to grab "Date Dealer Paid" (mostly
 * blank), which made every 2024 OK deal look unpaid and vanish from paid-basis
 * reports.
 */

function row(entries: Record<number, string>, len = 43): string[] {
  const a: string[] = new Array(len).fill('');
  for (const [k, v] of Object.entries(entries)) a[Number(k)] = v;
  return a;
}

// Verbatim header of the 2024 journal "November 2024" tab (row 4 = upper labels,
// row 5 = lower labels; data starts row 6).
const nov2024Upper = row({
  2: "Customer's", 3: "Customer's", 9: 'Postal', 11: 'Location', 12: '# of Units', 13: 'Product',
  14: 'Booking', 15: 'Lead', 16: "Dealer's", 17: "Installer's", 18: 'Date', 19: 'Installation',
  20: 'Deal', 22: 'Dealer', 23: 'Date Dealer', 24: 'Dealer', 25: 'Pay Dealer On', 26: 'Mgr',
  27: 'Mgr', 28: 'Date Mgr.', 29: 'Cust. Rebate Amt.', 30: 'Net', 31: 'HST', 32: 'ACCOUNT',
  33: 'Cash/Chq /CC', 34: 'PMT', 35: 'PAID ON', 36: 'DATE PAID', 37: 'Financed', 38: 'Who',
  39: 'HD', 40: 'Amt. Paid By', 41: 'Date', 42: 'Balance',
});
const nov2024Lower = row({
  0: 'No.', 1: 'Date', 2: 'Last Name', 3: 'First Name', 4: 'HD Ref #', 5: 'HD Store', 6: 'Address',
  7: 'City/Town', 8: 'Prov.', 9: 'Code', 10: 'Phone No.', 12: 'Sold', 13: 'Sold and any gifts',
  14: 'Secretary', 15: 'Generator', 16: 'Name', 17: 'Name', 18: 'Installed', 19: 'Fees', 20: 'Result',
  21: 'Comments', 22: 'Profit', 23: 'Paid', 24: 'Base', 25: 'This Amount', 26: 'Profit', 27: 'Profit',
  28: 'Paid', 29: 'Premium Gift Cost', 30: 'Sale', 31: 'Collected', 32: "REC'BLE", 33: 'Amount',
  34: 'Type', 35: "JJ'S AMEX", 36: 'TO AMEX', 37: 'Amount', 38: 'Financed', 39: 'Discount',
  40: 'Finance Co.', 41: 'Paid', 42: 'Of Sale',
});

describe('buildColumnMap — 2024 wide layout (the Nov/Dec 2024 missing-money bug)', () => {
  const map = buildColumnMap(nov2024Lower, nov2024Upper); // headerRow has Result+Last Name; rowAbove is the upper labels

  it('locks onto the funding "Date Paid" (idx 41), NOT "Date Dealer Paid" (idx 23)', () => {
    expect(map.result).toBe(20);
    expect(map.lastName).toBe(2);
    expect(map.datePaid).toBe(41);
  });

  it('still resolves the other key columns correctly', () => {
    expect(map.location).toBe(11); // office / Dealer column
    expect(map.hdStore).toBe(5);
    expect(map.grossAmount).toBe(32); // ACCOUNT REC'BLE
  });
});

describe('buildColumnMap — a plain modern header still maps Date Paid', () => {
  // The common case: a single funding "Date Paid" is the only paid column after Result.
  const header = row({ 0: 'Date', 2: 'Last Name', 5: 'HD Store', 11: 'Location', 20: 'Result', 21: "Account Rec'ble", 22: 'Date Paid' }, 24);
  const map = buildColumnMap(header, new Array(24).fill(''));

  it('picks the funding Date Paid and the other columns', () => {
    expect(map.result).toBe(20);
    expect(map.datePaid).toBe(22);
    expect(map.grossAmount).toBe(21);
  });
});
