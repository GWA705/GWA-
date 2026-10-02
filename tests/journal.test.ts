import { describe, it, expect } from 'vitest';
import { colLetter, matchTab, chooseRow, planRow } from '../src/lib/journal';

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

describe('planRow/chooseRow — live journal: next available line + duplicate guard', () => {
  // A journal grid modelled on the REAL sheet: two-row header on sheet rows 1–2,
  // data from row 3. Columns: 0=No. 1=Last Name 2=First Name 3=HD Ref 4=Loan
  // 5=Cash/Chq amount. Column 6 ("calc") stands in for the journal's formula /
  // legend / helper columns (Net, TAX, Balance, product legend, Province/Tax
  // rate) that carry a value — "$0.00", "-", "AB", a formula result — on EVERY
  // row, including blank pre-numbered ones. Rows 3–5 are real deals; rows 6–7 are
  // pre-numbered-but-empty (only the "No." column + the formula column are set).
  const layout = {
    headerBottomRow: 2,
    firstDataRow: 3,
    columns: { lastName: 1, firstName: 2, hdRef: 3, loanNo: 4, cashAmount: 5 } as Record<string, number>,
    rows: [
      ['', '', '', '', '', '', ''],
      ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Amount', 'Net'],
      ['1', 'Smith', 'John', '111', '', '1200', '$1,200.00'],
      ['2', 'Jones', 'Mary', '222', '', '900', '$900.00'],
      ['3', 'Brown', 'Al', '333', '', '300', '$300.00'],
      ['4', '', '', '', '', '', '$0.00'], // pre-numbered blank — formula col shows $0.00
      ['5', '', '', '', '', '', '$0.00'], // pre-numbered blank — formula col shows $0.00
    ],
  };
  const deal = (over: Partial<{ lastName: string; hdRef: string | null; loanNo: string | null; knownRow: number | null }> = {}) => ({
    lastName: 'Freeborn', hdRef: '999', loanNo: null, knownRow: null, ...over,
  });

  it('LIVE FORMULA COLUMNS: lands on the first blank deal line, ignoring the $0.00 formula column', () => {
    // The real bug: every pre-numbered blank row carries a formula column that
    // shows "$0.00" (Net/TAX/Balance/…). Judging occupancy by that column made
    // every line look taken, so deals were appended below the totals. Occupancy
    // is now judged only by the deal columns (name/ref/amounts), so row 6 — the
    // first line with no deal on it — is correctly chosen.
    expect(planRow(layout, deal(), 'live')).toEqual({ kind: 'empty', row: 6 });
  });

  it('fills the first blank deal line even when a totals row sits below it', () => {
    // Pre-numbered blank rows (5–6) sit ABOVE a totals row (7), with a deal
    // wrongly appended below it (8). The next available line is the first blank
    // deal line (5) — the formula column shows $0.00 on every row and is ignored.
    const withTotals = {
      ...layout,
      rows: [
        ['', '', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Amount', 'Net'],
        ['1', 'Smith', 'John', '111', '', '1200', '$1,200.00'], // row 3 deal
        ['2', 'Jones', 'Mary', '222', '', '900', '$900.00'], // row 4 deal
        ['3', '', '', '', '', '', '$0.00'], // row 5 pre-numbered BLANK
        ['4', '', '', '', '', '', '$0.00'], // row 6 pre-numbered BLANK
        ['', '', '', '', '', '481688', '$481,688.00'], // row 7 TOTALS (amount filled)
        ['', 'Appended', 'Guy', '', '', '2500', '$2,500.00'], // row 8 deal wrongly appended below
      ],
    };
    expect(chooseRow(withTotals, deal(), 'live')).toBe(5);
  });

  it('never lands on a totals row (blank name but a real amount) — appends below', () => {
    // A totals row directly after the deals, no blank slot above it → append below.
    const totalsNoBlanks = {
      ...layout,
      rows: [
        ['', '', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Amount', 'Net'],
        ['1', 'Smith', 'John', '111', '', '1200', '$1,200.00'], // row 3 deal
        ['2', 'Jones', 'Mary', '222', '', '900', '$900.00'], // row 4 deal
        ['', '', '', '', '', '12345', '$12,345.00'], // row 5 TOTALS (amount filled)
      ],
    };
    expect(chooseRow(totalsNoBlanks, deal(), 'live')).toBe(6);
  });

  it('never lands on a notes row (note typed in the Last Name column)', () => {
    // In the real journal a "notes only" line is typed into the name column, so it
    // reads as occupied and is skipped — the deal lands on the blank line after it.
    const withNote = {
      ...layout,
      rows: [
        ['', '', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Amount', 'Net'],
        ['1', 'Smith', 'John', '111', '', '1200', '$1,200.00'], // row 3 deal
        ['2', 'SEE NOTE: clean air and water', '', '', '', '', '$0.00'], // row 4 note in name col
        ['3', '', '', '', '', '', '$0.00'], // row 5 pre-numbered BLANK
      ],
    };
    expect(chooseRow(withNote, deal(), 'live')).toBe(5);
  });

  it('DUPLICATE GUARD: reuses an existing row matched by HD ref (no duplicate, fill blanks)', () => {
    // A staff member typed this deal on row 4 (Jones, HD ref 222). A portal write
    // for the same customer + ref must REUSE row 4, not append a duplicate.
    expect(planRow(layout, deal({ lastName: 'Jones', hdRef: '222' }), 'live')).toEqual({ kind: 'match', row: 4 });
  });

  it('DUPLICATE GUARD: reuses an existing row matched by Loan # too', () => {
    const l = { ...layout, rows: layout.rows.map((r) => [...r]) };
    l.rows[3][4] = 'FIT-789'; // give Jones (row 4) a loan number
    expect(planRow(l, deal({ lastName: 'Jones', hdRef: null, loanNo: 'FIT-789' }), 'live')).toEqual({ kind: 'match', row: 4 });
  });

  it('CONFLICT: same reference number but a different name is left for a human (not written)', () => {
    // Ref 222 is on row 4 under "Jones"; a deal with ref 222 but name Freeborn must
    // NOT be written — prevents corrupting the wrong deal or duplicating.
    const p = planRow(layout, deal({ lastName: 'Freeborn', hdRef: '222' }), 'live');
    expect(p.kind).toBe('conflict');
    expect(p.row).toBe(4);
  });

  it('CONFLICT: a reference number already on several rows is flagged', () => {
    const dupe = { ...layout, rows: layout.rows.map((r) => [...r]) };
    dupe.rows[4][3] = '222'; // Brown (row 5) now ALSO carries HD ref 222
    expect(planRow(dupe, deal({ lastName: 'Jones', hdRef: '222' }), 'live').kind).toBe('conflict');
  });

  it('no reference match → first blank deal line, never onto a deal row', () => {
    expect(planRow(layout, deal({ hdRef: '999' }), 'live')).toEqual({ kind: 'empty', row: 6 });
  });

  it('updates in place only when the remembered row still holds this customer', () => {
    expect(chooseRow(layout, deal({ lastName: 'Jones', knownRow: 4 }), 'live')).toBe(4);
    // Remembered row whose last name no longer matches → re-place, don't clobber.
    expect(chooseRow(layout, deal({ lastName: 'Freeborn', knownRow: 4 }), 'live')).toBe(6);
    // Remembered row that is actually blank → re-place to the first blank line.
    expect(chooseRow(layout, deal({ lastName: 'Freeborn', knownRow: 6 }), 'live')).toBe(6);
  });

  it('test sandbox stays lenient (fills the first blank Last Name row)', () => {
    // Demonstrates the OLD behavior the live rule intentionally avoids.
    expect(chooseRow(layout, deal(), 'test')).toBe(6);
  });
});
