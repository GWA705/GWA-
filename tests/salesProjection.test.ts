import { describe, it, expect } from 'vitest';
import { projectYear, type MonthCell } from '@/lib/reporting/salesProjection';

const cells = (gross: number[], counts?: number[]): MonthCell[] =>
  gross.map((g, i) => ({ gross: g, count: counts ? counts[i] : Math.round(g / 10000) }));

// A July-heavy prior year (same shape as the office's real seasonality).
const PRIOR = cells([80, 90, 110, 120, 150, 180, 260, 200, 140, 120, 100, 90].map((n) => n * 1000));

describe('sales projection', () => {
  it('reconciles actuals and projects the rest of the year (seasonal)', () => {
    const now = new Date(2026, 9, 15); // Oct 2026 → 9 completed months (Jan–Sep), Oct partial
    // Jan–Sep banked, Oct partial, Nov/Dec not started.
    const actual = cells([70, 85, 100, 115, 140, 170, 250, 190, 130, 40, 0, 0].map((n) => n * 1000));
    const r = projectYear(actual, PRIOR, 2026, now);

    expect(r.completedMonths).toBe(9);
    expect(r.seasonal).toBe(true);
    // Banked-to-date = Jan–Sep + the partial Oct, matching the inputs exactly.
    const banked = actual.slice(0, 10).reduce((s, m) => s + m.gross, 0);
    expect(r.ytd).toBe(banked);
    // Full-year estimate is at least what's banked, with a sane low≤expected≤high band.
    expect(r.fullYear.expected).toBeGreaterThanOrEqual(r.ytd);
    expect(r.fullYear.low).toBeLessThanOrEqual(r.fullYear.expected);
    expect(r.fullYear.high).toBeGreaterThanOrEqual(r.fullYear.expected);
    // Past months are actuals; current + future months are flagged projected.
    expect(r.months[3].isProjected).toBe(false);
    expect(r.months[9].isProjected).toBe(true); // Oct (partial)
    expect(r.months[9].isPartial).toBe(true);
    expect(r.months[11].isProjected).toBe(true); // Dec
    // A projected month never falls below what's already banked in it.
    expect(r.months[9].projected).toBeGreaterThanOrEqual(actual[9].gross);
  });

  it('is final once the year is complete', () => {
    const now = new Date(2027, 0, 20); // projecting 2026 from 2027 → whole year done
    const actual = cells([70, 85, 100, 115, 140, 170, 250, 190, 130, 160, 110, 95].map((n) => n * 1000));
    const r = projectYear(actual, PRIOR, 2026, now);
    const total = actual.reduce((s, m) => s + m.gross, 0);
    expect(r.isComplete).toBe(true);
    expect(r.fullYear.expected).toBe(total);
    expect(r.fullYear.low).toBe(total);
    expect(r.fullYear.high).toBe(total);
    expect(r.months.every((m) => !m.isProjected)).toBe(true);
  });

  it('falls back to a wider straight-line band with no prior year', () => {
    const now = new Date(2026, 5, 10); // Jun 2026 → 5 completed months
    const actual = cells([100, 100, 100, 100, 100, 30, 0, 0, 0, 0, 0, 0].map((n) => n * 1000));
    const noPrior = cells(new Array(12).fill(0));
    const r = projectYear(actual, noPrior, 2026, now);
    expect(r.seasonal).toBe(false);
    // Flat run rate = 100k/mo over 5 completed months → ~1.2M for the year.
    expect(r.fullYear.expected).toBeGreaterThan(1_000_000);
    expect(r.fullYear.high).toBeGreaterThan(r.fullYear.expected);
    expect(r.fullYear.low).toBeLessThan(r.fullYear.expected);
  });

  it('projects a plausible deal count', () => {
    const now = new Date(2026, 9, 1);
    const actual = cells(
      [70, 85, 100, 115, 140, 170, 250, 190, 130, 0, 0, 0].map((n) => n * 1000),
      [7, 9, 10, 11, 14, 17, 25, 19, 13, 0, 0, 0],
    );
    const r = projectYear(actual, PRIOR, 2026, now);
    expect(r.fullYearDeals).toBeGreaterThanOrEqual(r.ytdCount);
    expect(r.fullYearDeals).toBeLessThan(400); // sanity ceiling
  });
});
