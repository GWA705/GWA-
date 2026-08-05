import { describe, it, expect } from 'vitest';
import { exemptionSummary } from '@/lib/tax';

describe('exemptionSummary', () => {
  it('returns NONE when the deal is not flagged tax-exempt', () => {
    expect(exemptionSummary({ taxExempt: false, province: 'ON', deliveredToReserve: false }).type).toBe('NONE');
  });

  it('is FULL when delivered to a reserve (any province)', () => {
    expect(exemptionSummary({ taxExempt: true, province: 'ON', deliveredToReserve: true }).type).toBe('FULL');
    expect(exemptionSummary({ taxExempt: true, province: 'BC', deliveredToReserve: true }).type).toBe('FULL');
  });

  it('is PROVINCIAL_ONLY off-reserve in Ontario (8% POS rebate, GST still charged)', () => {
    const s = exemptionSummary({ taxExempt: true, province: 'ON', deliveredToReserve: false });
    expect(s.type).toBe('PROVINCIAL_ONLY');
    expect(s.detail).toContain('5% federal GST');
  });

  it('flags NEEDS_REVIEW off-reserve in a province we have not encoded yet', () => {
    expect(exemptionSummary({ taxExempt: true, province: 'BC', deliveredToReserve: false }).type).toBe('NEEDS_REVIEW');
  });
});
