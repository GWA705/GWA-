import { describe, it, expect } from 'vitest';
import { buildBreakdown, COST_DEFAULTS, COST_KEYS, type CostConfig } from '../src/lib/costs';

const cfg: CostConfig = {
  googleAutocompletePer1000: 2.83,
  googleDetailsPer1000: 17.0,
  googleFreeCredit: 0,
  render: 25,
  awsS3: 5,
  awsRds: 30,
  email: 0,
  domain: 2,
};

describe('buildBreakdown', () => {
  it('prices Google usage per 1,000 and adds the fixed bills', () => {
    const b = buildBreakdown(cfg, 1000, 200, '2026-08');
    // 1000/1000 × 2.83 = 2.83 ; 200/1000 × 17 = 3.40 ; google = 6.23
    expect(b.google.autocompleteCalls).toBe(1000);
    expect(b.google.netCost).toBeCloseTo(6.23, 2);
    // fixed = 25 + 5 + 30 + 0 + 2 = 62 ; total = 68.23
    expect(b.total).toBeCloseTo(68.23, 2);
  });

  it('is just the fixed bills when there is no usage', () => {
    const b = buildBreakdown(cfg, 0, 0, '2026-08');
    expect(b.google.netCost).toBe(0);
    expect(b.total).toBeCloseTo(62, 2);
  });

  it('applies a free credit but never drives the Google line negative', () => {
    const withCredit: CostConfig = { ...cfg, googleFreeCredit: 100 };
    const b = buildBreakdown(withCredit, 1000, 200, '2026-08'); // google gross 6.23
    expect(b.google.freeCredit).toBeCloseTo(6.23, 2); // capped at the gross
    expect(b.google.netCost).toBe(0);
    // total = fixed only (62), credit line offsets the two google lines exactly
    expect(b.total).toBeCloseTo(62, 2);
  });

  it('defaults are self-consistent with the config keys', () => {
    expect(COST_DEFAULTS[COST_KEYS.googleDetailsPer1000]).toBe(17);
    expect(COST_DEFAULTS[COST_KEYS.render]).toBe(25);
  });
});
