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

  it('writes below all content when there is no empty slot above it — never onto the notes row', () => {
    // Deals (3–5) then a notes row (6) are contiguous content; the first empty
    // line is 7. The notes row (blank Last Name but real notes) is never used.
    expect(chooseRow(layout, deal(), 'live')).toBe(7);
  });

  it('fills the first empty pre-numbered line even when a totals row sits below it', () => {
    // The real-world bug: pre-numbered blank rows (5–6) sit ABOVE a totals row
    // (7), with deals wrongly appended below it (8). The next available line is
    // the first blank pre-numbered row (5) — not beneath the totals/appended block.
    const withTotals = {
      ...layout,
      rows: [
        ['', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Notes'],
        ['1', 'Smith', 'John', '111', '', ''], // row 3 deal
        ['2', 'Jones', 'Mary', '222', '', ''], // row 4 deal
        ['3', '', '', '', '', ''], // row 5 pre-numbered BLANK
        ['4', '', '', '', '', ''], // row 6 pre-numbered BLANK
        ['', '', '', '', '', '481,688.00'], // row 7 TOTALS (blank Last Name, has an amount)
        ['', 'Appended', 'Guy', '', '', ''], // row 8 deal wrongly appended below the totals
      ],
    };
    expect(chooseRow(withTotals, deal(), 'live')).toBe(5);
  });

  it('LIVE FORMULA ZEROS: a pre-numbered row whose calc columns show $0.00 is still a free slot', () => {
    // The real live-journal bug: every pre-numbered blank row carries formula
    // columns that render "$0.00" / "-" (Net, TAX, Balance, Pay-to-dealer …), so
    // the old "any non-empty cell = occupied" check thought EVERY line was taken
    // and appended new deals below the totals row. The blank rows (5–6) must still
    // be recognised as free — the deal lands on the first one (row 5).
    const withFormulaZeros = {
      ...layout,
      columns: { lastName: 1, firstName: 2, hdRef: 3, loanNo: 4 } as Record<string, number>,
      rows: [
        ['', '', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Net', 'Balance'],
        ['1', 'Smith', 'John', '111', '', '$1,200.00', '$300.00'], // row 3 real deal
        ['2', 'Jones', 'Mary', '222', '', '$900.00', '$0.00'], // row 4 real deal
        ['3', '', '', '', '', '$0.00', '$0.00'], // row 5 BLANK (formula zeros only)
        ['4', '', '', '', '', '$0.00', '-'], // row 6 BLANK (formula zeros / dash)
        ['', '', '', '', '', '$2,100.00', '$300.00'], // row 7 TOTALS (non-zero sums)
      ],
    };
    expect(chooseRow(withFormulaZeros, deal(), 'live')).toBe(5);
  });

  it('never lands on a totals row (blank Last Name but an amount)', () => {
    // A totals row directly after the deals, no blank slot above it → append below.
    const totalsNoBlanks = {
      ...layout,
      rows: [
        ['', '', '', '', '', ''],
        ['No.', 'Last Name', 'First Name', 'HD Ref #', 'Loan #', 'Notes'],
        ['1', 'Smith', 'John', '111', '', ''], // row 3 deal
        ['2', 'Jones', 'Mary', '222', '', ''], // row 4 deal
        ['', '', '', '', '', '12,345.00'], // row 5 TOTALS
      ],
    };
    expect(chooseRow(totalsNoBlanks, deal(), 'live')).toBe(6);
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

  it('no reference match → next empty line, never onto a deal or notes row', () => {
    expect(planRow(layout, deal({ hdRef: '999' }), 'live')).toEqual({ kind: 'empty', row: 7 });
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
