import { describe, it, expect } from 'vitest';
import {
  isMonthTab,
  findHeaderRowIndex,
  buildColumnMap,
  officeFromMetadata,
} from '../src/lib/reporting/journalRead';

// Build a sparse row: place values at given 0-based column indexes.
function row(cells: Record<number, string>): string[] {
  const max = Math.max(...Object.keys(cells).map(Number));
  const out = new Array(max + 1).fill('');
  for (const [i, v] of Object.entries(cells)) out[Number(i)] = v;
  return out;
}

describe('isMonthTab — tolerant of every journal naming style', () => {
  it('accepts the modern "Month YYYY" / "Mon.YYYY" tabs', () => {
    for (const t of ['March 2026', 'Mar 2026', 'Mar.2026', 'July 2025', 'Sept 2025']) {
      expect(isMonthTab(t)).toBe(true);
    }
  });

  it('accepts the older 2024 book styles (bare month, 2-digit year, apostrophe)', () => {
    for (const t of ['MARCH', 'March', 'Mar', "March '24", 'Mar-24', 'March 24', 'March-2024']) {
      expect(isMonthTab(t)).toBe(true);
    }
  });

  it('rejects non-data tabs', () => {
    for (const t of ['Summary', 'Totals', 'Q1', 'Sheet1', 'Cover', '', 'YTD 2024']) {
      expect(isMonthTab(t)).toBe(false);
    }
  });
});

// A faithful mock of the 2024 journal's grid: 3 metadata rows, a two-row header
// (rows 4 & 5), then data. Columns follow the screenshots the office provided.
const HEADER_ABOVE = row({
  0: 'No.', 1: 'Date', 2: "Customer's", 3: "Customer's", 4: 'HD Ref #', 5: 'HD Store',
  6: 'Address', 7: 'City/Town', 8: 'Province', 9: 'Postal', 10: 'Phone No.',
  11: 'Booking', 12: 'Lead', 13: "Dealer's", 14: "Installer's", 15: 'Date',
  16: 'Installation', 17: 'Deal', 18: 'Product', 19: '# of Units', 20: 'Comments',
  21: 'Dealer', 24: 'Pay Dealer On', 28: 'Cust. Rebate Amt.', 29: 'Net', 30: 'HST',
  31: 'ACCOUNT', 32: 'Cash/Chq /CC', 33: 'Credit Card', 35: 'Financed', 36: 'Who',
  41: 'Amt. Paid By', 42: 'Date',
});
const HEADER = row({
  0: 'No.', 1: 'Date', 2: 'Last Name', 3: 'First Name', 9: 'Code', 11: 'Secretary',
  12: 'Generator', 13: 'Name', 14: 'Name', 15: 'Installed', 16: 'Fees', 17: 'Result',
  18: 'Sold and any gifts', 19: 'Sold', 21: 'Profit', 24: 'This Amount',
  28: 'Premium Gift Cost', 29: 'Sale', 30: 'Collected', 31: "REC'BLE", 32: 'Amount',
  33: 'Discount', 35: 'Amount', 36: 'Financed', 41: 'Finance Co.', 42: 'Paid',
});

const GRID_2024: string[][] = [
  ['Distributor: JJ FRANCOEUR'],
  ['Office: GEORGIAN WATER & AIR'],
  ['Month: MARCH 2024'],
  HEADER_ABOVE,
  HEADER,
  row({
    0: '2', 1: '14-Mar', 2: 'STROME', 3: 'DAVE', 4: '701023338', 5: 'PARRY SOUND',
    6: '207 SHEBESHEKONG RD S', 7: 'NOBEL', 8: 'ON', 9: 'P0G1G0', 10: '705-774-1268',
    17: 'OK', 18: 'WS,COUN,UV10,SOAP', 29: '9953.00', 30: '1293.89', 31: '11246.89',
    36: 'HDCC', 41: '0.00', 42: '21-Mar',
  }),
];

describe('2024 journal layout (different from the rest) still parses', () => {
  it('finds the two-row header despite the metadata block above it', () => {
    expect(findHeaderRowIndex(GRID_2024)).toBe(4);
  });

  it('reads the office from the metadata block (there is no Location column)', () => {
    expect(officeFromMetadata(GRID_2024, 4)).toBe('GEORGIAN WATER & AIR');
  });

  it('maps every field we search on to the correct 2024 column', () => {
    const map = buildColumnMap(GRID_2024[4], GRID_2024[3]);
    expect(map.lastName).toBe(2);
    expect(map.firstName).toBe(3);
    expect(map.hdRef).toBe(4);
    expect(map.hdStore).toBe(5);
    expect(map.address).toBe(6);
    expect(map.city).toBe(7);
    expect(map.phone).toBe(10);
    expect(map.result).toBe(17);
    expect(map.product).toBe(18);
    expect(map.date).toBe(1);
    expect(map.datePaid).toBe(42); // "Date Paid", not "Amt. Paid By…"
    expect(map.grossAmount).toBe(31); // ACCOUNT REC'BLE
    expect(map.netSaleAmount).toBe(29);
    expect(map.taxAmount).toBe(30);
    // No Location column in the 2024 book — the reader falls back to the office.
    expect(map.location).toBe(-1);
  });
});
