import { describe, it, expect } from 'vitest';
import { parseHdRemittanceText } from '@/lib/hdRemittance';

// The EXACT text unpdf extracts from the real 2026-10-26 Home Depot remittance
// (document 2000160840) — the one the old Google script shuffled. One row per
// line, each invoice carrying its own net, plus a lead-fee deduction and HD's
// printed grand total.
const REAL = [
  'SEPT26LEADFEES31 10/16/2026 DeductionSept26leadfees 490.00- 0.00 490.00-',
  '701812650 10/23/2026 338.81 0.00 338.81',
  '800256358 10/23/2026 2,146.96 0.00 2,146.96',
  '800257092 10/23/2026 8,704.19 0.00 8,704.19',
  '800256982 10/23/2026 3,112.18 0.00 3,112.18',
  '800257127 10/23/2026 4,916.34 0.00 4,916.34',
  '800257099 10/23/2026 6,900.93 0.00 6,900.93',
  '800256701 10/23/2026 8,289.69 0.00 8,289.69',
  'Invoice Number Inv Date Description Gross Amount Adjmt Amount Net Amount',
  'Document Number/Numèro de Document: 2000160840',
  'Document Date/Date de Document: 10/26/2026',
  'Payment Date/Date de Paiement: 10/27/2026',
  'Currency/Devise: CAD',
  '33,919.10 0.00 33,919.10',
  'GEORGIAN HEALTH AND SAFETY LTD',
].join('\n');

// The ground truth from the raw PDF — HD ID → its real net amount.
const TRUTH: Record<string, number> = {
  '701812650': 338.81,
  '800256358': 2146.96,
  '800257092': 8704.19,
  '800256982': 3112.18,
  '800257127': 4916.34,
  '800257099': 6900.93,
  '800256701': 8289.69,
};

describe("Home Depot remittance parser — the file that shuffled", () => {
  const parsed = parseHdRemittanceText(REAL);

  it('reads the header correctly', () => {
    expect(parsed.documentNumber).toBe('2000160840');
    expect(parsed.documentDate).toBe('10/26/2026');
    expect(parsed.paymentDate).toBe('10/27/2026');
    expect(parsed.grandTotal).toBeCloseTo(33919.10, 2);
  });

  it('maps every HD ID to ITS OWN amount (no shuffle)', () => {
    const invoices = parsed.lines.filter((l) => l.type === 'INVOICE');
    expect(invoices).toHaveLength(7);
    for (const inv of invoices) {
      expect(TRUTH[inv.hdIdNumber], `amount for ${inv.hdIdNumber}`).toBeCloseTo(inv.amount, 2);
    }
    // Spot-check the two the script swapped worst: 701812650 is $338.81 (not $8,289.69).
    const byId = Object.fromEntries(invoices.map((l) => [l.hdIdNumber, l.amount]));
    expect(byId['701812650']).toBeCloseTo(338.81, 2);
    expect(byId['800256701']).toBeCloseTo(8289.69, 2);
  });

  it('captures the lead fee as a NEGATIVE deduction (not dropped)', () => {
    const fee = parsed.lines.find((l) => l.type === 'DEDUCTION');
    expect(fee).toBeTruthy();
    expect(fee!.amount).toBeCloseTo(-490.0, 2);
    expect(fee!.isChargeback).toBe(false);
    expect((fee!.description || '').toLowerCase()).toContain('lead');
  });

  it('reconciles: the lines sum to HD’s printed grand total', () => {
    const sum = parsed.lines.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBeCloseTo(33919.10, 2); // 34,409.10 invoices − 490.00 fee
    expect(sum).toBeCloseTo(parsed.grandTotal!, 2); // the integrity guard passes
  });

  it('the double-check passes on the clean file', () => {
    expect(parsed.verification.ok).toBe(true);
    expect(parsed.verification.grandTotalFound).toBe(true);
    expect(parsed.verification.reconciles).toBe(true);
    expect(parsed.verification.rowsSeen).toBe(8); // 7 invoices + 1 fee
    expect(parsed.verification.linesCaptured).toBe(8);
    expect(parsed.verification.issues).toHaveLength(0);
  });

  it('the double-check CATCHES a misread amount (row math + reconciliation)', () => {
    // Corrupt one net so gross − adjmt ≠ net AND the page no longer reconciles.
    const bad = REAL.replace('800256358 10/23/2026 2,146.96 0.00 2,146.96', '800256358 10/23/2026 2,146.96 0.00 9,999.99');
    const p = parseHdRemittanceText(bad);
    expect(p.verification.ok).toBe(false);
    expect(p.verification.issues.join(' ')).toMatch(/add up|grand total/i);
  });

  it('the double-check REFUSES when the printed grand total is missing', () => {
    const noTotal = REAL.replace('33,919.10 0.00 33,919.10', '');
    const p = parseHdRemittanceText(noTotal);
    expect(p.verification.grandTotalFound).toBe(false);
    expect(p.verification.ok).toBe(false);
  });

  it('the double-check flags a row it could not capture (no HD ID)', () => {
    // A positive money row with a date but no HD ID / recognizable reference.
    const orphan = REAL + '\nUNKNOWNROW 10/23/2026 1,234.56 0.00 1,234.56';
    const p = parseHdRemittanceText(orphan);
    expect(p.verification.ok).toBe(false);
    expect(p.verification.issues.join(' ')).toMatch(/not captured/i);
  });

  it('classifies an embedded GRGA chargeback to its HD deal', () => {
    const p = parseHdRemittanceText(
      '800300001 10/23/2026 1,000.00 0.00 1,000.00\n' +
      'GRGA#800256358 10/01/2026 2,146.96- 0.00 2,146.96-\n' +
      '1,146.96 0.00 1,146.96',
    );
    const cb = p.lines.find((l) => l.type === 'CHARGEBACK');
    expect(cb).toBeTruthy();
    expect(cb!.hdIdNumber).toBe('800256358');
    expect(cb!.amount).toBeCloseTo(-2146.96, 2);
    expect(cb!.isChargeback).toBe(true);
    // Integrity still reconciles (1,000 − 2,146.96 would be negative; here grand
    // total line is 1,146.96 to keep the example self-consistent isn't required,
    // but the sign handling is what we assert).
  });
});
