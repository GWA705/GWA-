import { describe, it, expect } from 'vitest';
import { findHeaderRowIndex, buildColumnMap, parseFlexibleDate } from '@/lib/reporting/journalRead';

// Reconstruct the 2024 book's layout (from the real sheet): 3 metadata rows, a
// TWO-ROW header (group labels on top, field labels below), then data. Column
// positions match the real sheet (R = Deal/Result, AQ = Date/Paid, no Location).
function at(pairs: Record<number, string>): string[] {
  const keys = Object.keys(pairs).map(Number);
  if (keys.length === 0) return [];
  const row: string[] = new Array(Math.max(...keys) + 1).fill('');
  for (const [i, v] of Object.entries(pairs)) row[Number(i)] = v;
  return row;
}

const grid: string[][] = [
  at({ 0: 'Distributor: JJ FRANCOEUR' }),
  at({ 0: 'Office: GEORGIAN WATER & AIR' }),
  at({ 0: 'Month: MARCH 2024' }),
  // Row 4 — top/group header labels
  at({ 2: "Customer's", 3: "Customer's", 9: 'Postal', 11: 'Booking', 12: 'Lead', 13: "Dealer's", 14: "Installer's", 15: 'Date', 16: 'Installation', 17: 'Deal', 18: 'Product', 19: '# of Units', 21: 'Dealer', 24: 'Pay Dealer On', 29: 'Net', 30: 'HST', 31: 'ACCOUNT', 32: 'Cash/Chq /CC', 41: 'Amt. Paid By', 42: 'Date' }),
  // Row 5 — bottom/field header labels
  at({ 0: 'No.', 1: 'Date', 2: 'Last Name', 3: 'First Name', 4: 'HD Ref #', 5: 'HD Store', 6: 'Address', 7: 'City/Town', 8: 'Province', 9: 'Code', 10: 'Phone No.', 11: 'Secretary', 12: 'Generator', 13: 'Name', 14: 'Name', 15: 'Installed', 16: 'Fees', 17: 'Result', 18: 'Sold and any gifts', 19: 'Sold', 20: 'Comments', 21: 'Profit', 24: 'This Amount', 29: 'Sale', 30: 'Collected', 31: "REC'BLE", 32: 'Amount', 41: 'Finance Co.', 42: 'Paid' }),
  at({}), // blank row 6
  // Row 7 — first data row
  at({ 0: '1', 1: '21-Mar', 2: 'WORBOYS', 3: 'RUSTY', 4: '701017076', 5: 'PARRY SOUND', 6: '706 HIGHWAY 520', 7: 'DUNCHURCH', 8: 'ON', 17: 'PE/OK', 31: '0.00', 42: '19-Apr' }),
  at({ 0: '2', 1: '14-Mar', 2: 'STROME', 3: 'DAVE', 4: '701023338', 5: 'PARRY SOUND', 17: 'OK', 31: '11246.89', 41: 'HDCC', 42: '21-Mar' }),
];

describe('2024 journal layout parsing', () => {
  it('finds the two-row header', () => {
    expect(findHeaderRowIndex(grid)).toBe(4);
  });

  it('maps Result and Date columns (so the tab is not skipped)', () => {
    const idx = findHeaderRowIndex(grid);
    const colMap = buildColumnMap(grid[idx], grid[idx - 1]);
    expect(colMap.result).toBe(17); // R
    expect(colMap.date).toBe(1); // B
    expect(colMap.lastName).toBe(2); // C
    expect(colMap.datePaid).toBe(42); // AQ
    expect(colMap.result).not.toBe(-1);
    expect(colMap.date).not.toBe(-1);
  });

  it('parses the data rows into deals with dates', () => {
    const idx = findHeaderRowIndex(grid);
    const colMap = buildColumnMap(grid[idx], grid[idx - 1]);
    const d1 = parseFlexibleDate(grid[6][colMap.date], 2024);
    expect(d1?.getFullYear()).toBe(2024);
    expect(d1?.getMonth()).toBe(2); // March
  });
});
