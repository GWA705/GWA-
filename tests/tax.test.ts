import { describe, it, expect } from 'vitest';
import { netBeforeTax, taxRateFor } from '../src/lib/tax';

describe('netBeforeTax', () => {
  it('backs 13% HST out of an Ontario total', () => {
    const n = netBeforeTax(12077.44, 'ON');
    expect(n.rate).toBe(0.13);
    expect(n.ratePct).toBe(13);
    expect(n.net).toBeCloseTo(10688.0, 2); // 12077.44 / 1.13
    expect(n.net + n.tax).toBeCloseTo(12077.44, 2);
  });

  it('uses 15% for Atlantic HST provinces', () => {
    expect(netBeforeTax(1150, 'NB').net).toBeCloseTo(1000, 2);
  });

  it('uses QC combined 14.975%', () => {
    const n = netBeforeTax(1149.75, 'QC');
    expect(n.ratePct).toBe(14.975);
    expect(n.net).toBeCloseTo(1000, 2);
  });

  it('GST-only province (AB) removes 5%', () => {
    expect(taxRateFor('AB')).toBe(0.05);
    expect(netBeforeTax(105, 'AB').net).toBeCloseTo(100, 2);
  });

  it('no province → net equals total, no tax', () => {
    const n = netBeforeTax(500, null);
    expect(n.net).toBe(500);
    expect(n.tax).toBe(0);
  });
});
