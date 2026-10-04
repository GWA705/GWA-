import { describe, it, expect } from 'vitest';
import { findRowInLayout, type JournalLayout } from '@/lib/journal';

// A minimal two-column-key layout: Last Name / First Name / HD Ref / Loan.
// rows[0] is the header (sheet row 1); data starts at sheet row 2 (rows[1]).
const layout: JournalLayout = {
  headerBottomRow: 1,
  firstDataRow: 2,
  columns: { lastName: 0, firstName: 1, hdRef: 2, loanNo: 3 },
  rows: [
    ['Last Name', 'First Name', 'HD Ref', 'Loan'],
    ['Cho', 'Daniel', '800255041', ''],
    ['Smith', 'Alice', '800111111', 'L123'],
    ['Smith', 'Bob', '', ''], // a second Smith → last name alone is ambiguous
    ['Okafor', 'Mary', '', ''],
  ],
};

const deal = (over: Partial<{ lastName: string; firstName: string; hdRef: string | null; loanNo: string | null }>) => ({
  lastName: '', firstName: '', hdRef: null, loanNo: null, ...over,
});

describe('findRowInLayout', () => {
  it('matches on HD Ref # and returns the 1-based sheet row', () => {
    expect(findRowInLayout(layout, deal({ hdRef: '800255041', lastName: 'Cho' }), false)).toBe(2);
  });

  it('is tolerant of HD # formatting differences (normalized compare)', () => {
    expect(findRowInLayout(layout, deal({ hdRef: ' 800255041 ', lastName: 'cho' }), false)).toBe(2);
  });

  it('does NOT match when the HD # lands on a row with a different last name', () => {
    expect(findRowInLayout(layout, deal({ hdRef: '800255041', lastName: 'Jones' }), false)).toBeNull();
  });

  it('matches on Loan #', () => {
    expect(findRowInLayout(layout, deal({ loanNo: 'L123', lastName: 'Smith' }), true)).toBe(3);
  });

  it('matches an unambiguous name on the sale-month tab', () => {
    expect(findRowInLayout(layout, deal({ lastName: 'Okafor', firstName: 'Mary' }), true)).toBe(5);
  });

  it('refuses an ambiguous last name (two Smiths) with no reference', () => {
    expect(findRowInLayout(layout, deal({ lastName: 'Smith' }), true)).toBeNull();
  });

  it('never matches on name when name-matching is not allowed (cross-tab)', () => {
    expect(findRowInLayout(layout, deal({ lastName: 'Okafor', firstName: 'Mary' }), false)).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(findRowInLayout(layout, deal({ hdRef: '999999999', lastName: 'Nobody' }), true)).toBeNull();
  });
});
