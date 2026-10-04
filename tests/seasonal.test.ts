import { describe, it, expect } from 'vitest';
import { isSpookySeason, SPOOKY_START_DAY } from '@/lib/seasonal';

// Midday UTC keeps these clear of the Toronto/UTC offset so each date lands on
// the intended local calendar day.
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('isSpookySeason', () => {
  it('is off before the start day', () => {
    expect(isSpookySeason(at('2026-10-17'))).toBe(false);
    expect(isSpookySeason(at('2026-10-01'))).toBe(false);
  });

  it('is on from the start day through Halloween', () => {
    expect(SPOOKY_START_DAY).toBe(18);
    expect(isSpookySeason(at('2026-10-18'))).toBe(true);
    expect(isSpookySeason(at('2026-10-24'))).toBe(true);
    expect(isSpookySeason(at('2026-10-31'))).toBe(true);
  });

  it('reverts on November 1 and stays off the rest of the year', () => {
    expect(isSpookySeason(at('2026-11-01'))).toBe(false);
    expect(isSpookySeason(at('2026-11-15'))).toBe(false);
    expect(isSpookySeason(at('2026-12-31'))).toBe(false);
    expect(isSpookySeason(at('2026-07-04'))).toBe(false);
  });
});
