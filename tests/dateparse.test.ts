import { describe, it, expect } from 'vitest';
import { parseFlexibleDate } from '@/lib/dateparse';

describe('parseFlexibleDate', () => {
  it('reads ISO year-first dates unambiguously', () => {
    expect(parseFlexibleDate('1990-03-12')).toEqual({ iso: '1990-03-12', ambiguous: false });
    expect(parseFlexibleDate('1990/03/12')).toEqual({ iso: '1990-03-12', ambiguous: false });
    expect(parseFlexibleDate('1990.03.12')).toEqual({ iso: '1990-03-12', ambiguous: false });
  });

  it('reads month-first numeric dates with any separator (the old parser only did slash/dash)', () => {
    expect(parseFlexibleDate('03/12/1990')).toEqual({ iso: '1990-03-12', ambiguous: true }); // 03 & 12 both ≤12 → guessed order
    expect(parseFlexibleDate('03.12.1990').iso).toBe('1990-03-12'); // dots now work
    expect(parseFlexibleDate('3-5-1990').iso).toBe('1990-03-05');
  });

  it('resolves order when one number is clearly the day (>12)', () => {
    expect(parseFlexibleDate('03/25/1990')).toEqual({ iso: '1990-03-25', ambiguous: false });
    expect(parseFlexibleDate('25/03/1990')).toEqual({ iso: '1990-03-25', ambiguous: false });
  });

  it('flags a genuinely ambiguous day/month as uncertain', () => {
    expect(parseFlexibleDate('05/06/1990').ambiguous).toBe(true); // May 6 vs Jun 5
    expect(parseFlexibleDate('05/05/1990').ambiguous).toBe(false); // same either way
  });

  it('honours preferDMY for ambiguous numeric dates', () => {
    expect(parseFlexibleDate('03/12/1990', { preferDMY: true }).iso).toBe('1990-12-03');
    expect(parseFlexibleDate('03/12/1990').iso).toBe('1990-03-12');
  });

  it('expands 2-digit years and marks them uncertain', () => {
    expect(parseFlexibleDate('03/25/90')).toEqual({ iso: '1990-03-25', ambiguous: true });
    expect(parseFlexibleDate('03/25/28').iso).toBe('2028-03-25');
  });

  it('reads written-month dates', () => {
    expect(parseFlexibleDate('March 12, 1990')).toEqual({ iso: '1990-03-12', ambiguous: false });
    expect(parseFlexibleDate('12 Mar 1990').iso).toBe('1990-03-12');
    expect(parseFlexibleDate('Sept. 9 2026').iso).toBe('2026-09-09');
  });

  it('rejects impossible dates and junk', () => {
    expect(parseFlexibleDate('13/32/1990').iso).toBeNull();
    expect(parseFlexibleDate('2026-02-31').iso).toBeNull();
    expect(parseFlexibleDate('not a date').iso).toBeNull();
    expect(parseFlexibleDate('').iso).toBeNull();
  });
});
