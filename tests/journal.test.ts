import { describe, it, expect } from 'vitest';
import { colLetter, matchTab, chooseRow } from '../src/lib/journal';

describe('colLetter', () => {
  it('maps 0-based indexes to A1 letters', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(25)).toBe('Z');
    expect(colLetter(26)).toBe('AA');
    expect(colLetter(27)).toBe('AB');
    expect(colLetter(51)).toBe('AZ');
  });
});

describe('matchTab', () => {
  const d = (y: number, m: number) => new Date(Date.UTC(y, m, 15));

  it('matches the journal naming variants for the right month + year', () => {
    const tabs = ['Jan.2026', 'Feb.2026', 'Jul.2026', 'Aug.2026'];
    expect(matchTab(tabs, d(2026, 6))).toBe('Jul.2026'); // July
    expect(matchTab(tabs, d(2026, 0))).toBe('Jan.2026');
  });

  it('tolerates full month names and 2-digit years', () => {
    expect(matchTab(['July 2026'], d(2026, 6))).toBe('July 2026');
    expect(matchTab(['Jul 26'], d(2026, 6))).toBe('Jul 26');
  });

  it('does not match the wrong year', () => {
    expect(matchTab(['Jul.2025'], d(2026, 6))).toBeNull();
    expect(matchTab(['Aug.2026'], d(2026, 6))).toBeNull();
  });
});

describe('chooseRow — live journal is append-only', () => {
  // A journal grid: two-row header on sheet rows 1–2, data from row 3.
  // Columns: 0=No. 1=Last Name 2=First Name 3=HD Ref 4=Loan 5=(office notes).
  // Rows 3–5 are real deals; row 6 has a blank Last Name but office NOTES in
  // col 5 (the exact shape that got clobbered); rows 7–8 are pre-numbered but
  // otherwise empty (the live journal pre-fills the "No." column down blanks).
  const layout = {
    headerBottomRow: 2,
    firstDataRow: 3,
    columns: { lastName: 1, firstName: 2, hdRef: 3, loanNo: 4 } as Record<string, number>,
    rows: [
      ['', '', '', '', '', ''],
      ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Notes'],
      ['1', 'Smith', 'John', '111', '', ''],
      ['2', 'Jones', 'Mary', '222', '', ''],
      ['3', 'Brown', 'Al', '333', '', ''],
      ['4', '', '', '', '', 'Clean Air and Water'], // notes row, blank Last Name
      ['5', '', '', '', '', ''], // pre-numbered, empty
      ['6', '', '', '', '', ''], // pre-numbered, empty
    ],
  };
  const deal = (over: Partial<{ lastName: string; hdRef: string | null; loanNo: string | null; knownRow: number | null }> = {}) => ({
    lastName: 'Freeborn', hdRef: '999', loanNo: null, knownRow: null, ...over,
  });

  it('appends a NEW deal below all content — never onto the notes row or a gap', () => {
    // The last row with content is the notes row (sheet row 6); append at 7.
    expect(chooseRow(layout, deal(), 'live')).toBe(7);
  });

  it('never matches an existing row by reference number on live', () => {
    // HD ref 222 belongs to Jones (row 4); live must still append, not overwrite.
    expect(chooseRow(layout, deal({ hdRef: '222' }), 'live')).toBe(7);
  });

  it('updates in place only when the remembered row still holds this customer', () => {
    expect(chooseRow(layout, deal({ lastName: 'Jones', knownRow: 4 }), 'live')).toBe(4);
    // Remembered row whose last name no longer matches → append, don't clobber.
    expect(chooseRow(layout, deal({ lastName: 'Freeborn', knownRow: 4 }), 'live')).toBe(7);
    // Remembered row that a human blanked (now the notes row) → append.
    expect(chooseRow(layout, deal({ lastName: 'Freeborn', knownRow: 6 }), 'live')).toBe(7);
  });

  it('test sandbox stays lenient (fills the first blank Last Name row)', () => {
    // Demonstrates the OLD behavior the live rule intentionally avoids.
    expect(chooseRow(layout, deal(), 'test')).toBe(6);
  });
});
