import { describe, it, expect } from 'vitest';
import { locateStatusColumns } from '../src/lib/journal';

/**
 * The live journal has TWO "Date Paid" columns: an AMEX-group one that's usually
 * blank, and the deal-settlement one right after "Result" that the office fills
 * (the green column). The reader must read the settlement one — reading the
 * blank AMEX column made paid deals look unpaid.
 */
describe('locateStatusColumns', () => {
  // Two-row header modelled on the real August 2026 tab (cols A..T).
  // A   B    C          D           E        F        G H  I     J      K       L     M       N      O        P     Q      R     S    T
  const top = [
    '', '', "Customer's", "Customer's", '', 'How They', '', '', 'Financed', 'Cash/Chq /CC', 'Financed', 'WHOSE', '$ CHG', 'Date', 'Location', '', '', 'Date', 'Lead', "Dealer's",
  ];
  const bottom = [
    'No.', 'Date', 'Last Name', 'First Name', 'HD Ref #', 'Payed', '', '#', 'Term(s)', 'Amount', 'Amount', 'AMEX', 'TO AMEX', 'Paid', '', 'UNITS', 'Result', 'Paid', 'Generator', 'Name',
  ];

  it('picks the settlement Date Paid (after Result), not the earlier AMEX one', () => {
    const { lastNameCol, resultCol, paidCol } = locateStatusColumns(top, bottom);
    expect(lastNameCol).toBe(2); // C
    expect(resultCol).toBe(16); // Q
    expect(paidCol).toBe(17); // R — the green settlement column, NOT N (13)
  });

  it('does not mistake "Payed" for a paid column', () => {
    const { paidCol } = locateStatusColumns(top, bottom);
    expect(paidCol).not.toBe(5); // F is "How They Payed"
  });

  it('falls back to the only Date Paid column when there is no earlier decoy', () => {
    const t = ['', '', '', 'Date'];
    const b = ['No.', 'Last Name', 'Result', 'Paid'];
    const { resultCol, paidCol } = locateStatusColumns(t, b);
    expect(resultCol).toBe(2);
    expect(paidCol).toBe(3);
  });
});
