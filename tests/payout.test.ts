import { describe, it, expect } from 'vitest';
import { computeDealerPayout, provinceCode, PROVINCE_TAX_RATE } from '@/lib/payoutCalc';

describe('computeDealerPayout', () => {
  it('matches the NB calculator example to the cent', () => {
    const r = computeDealerPayout(4686.25, 'NB');
    expect(r.taxRate).toBe(0.15);
    expect(r.subtotal).toBe(4075.0);
    expect(r.hdDiscount).toBe(529.75);
    expect(r.afterHd).toBe(3545.25);
    expect(r.ibxDiscount).toBe(44.32);
    expect(r.afterIbx).toBe(3500.93);
    expect(r.hdProgram).toBe(187.45);
    expect(r.payout).toBe(3838.62);
  });

  it('uses 14% for Nova Scotia (not 15%)', () => {
    expect(PROVINCE_TAX_RATE.NS).toBe(0.14);
    const r = computeDealerPayout(4686.25, 'NS');
    expect(r.taxRate).toBe(0.14);
    expect(r.ok).toBe(true);
    // Tax nets out, so NS lands within a couple cents of the NB result.
    expect(Math.abs(r.payout - 3838.62)).toBeLessThan(0.05);
  });

  it('computes Ontario (13%)', () => {
    const r = computeDealerPayout(4686.25, 'ON');
    expect(r.taxRate).toBe(0.13);
    expect(r.ok).toBe(true);
    // ~81.9125% of the total, give or take rounding.
    expect(Math.abs(r.payout - 4686.25 * 0.819125)).toBeLessThan(0.1);
  });

  it('accepts full province names', () => {
    expect(provinceCode('Nova Scotia')).toBe('NS');
    expect(provinceCode('ontario')).toBe('ON');
    expect(computeDealerPayout(1000, 'New Brunswick').taxRate).toBe(0.15);
  });

  it('assumes Ontario for an unknown province and warns', () => {
    const r = computeDealerPayout(1000, 'ZZ');
    expect(r.taxRateAssumed).toBe(true);
    expect(r.taxRate).toBe(0.13);
    expect(r.warning).toMatch(/Unknown province/);
    expect(r.ok).toBe(true);
  });

  it('rejects a non-positive amount', () => {
    expect(computeDealerPayout(0, 'ON').ok).toBe(false);
    expect(computeDealerPayout(-50, 'ON').ok).toBe(false);
  });

  it('payout is always less than the total (discounts applied)', () => {
    for (const amt of [1200, 5000, 9999, 15000]) {
      for (const prov of ['ON', 'NB', 'NS', 'AB', 'BC']) {
        const r = computeDealerPayout(amt, prov);
        expect(r.payout).toBeGreaterThan(0);
        expect(r.payout).toBeLessThan(amt);
      }
    }
  });
});
