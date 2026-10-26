import { describe, it, expect } from 'vitest';
import { projectYear, projectFutureYear, type MonthCell } from '@/lib/reporting/salesProjection';
import { buildProjectionPdf, projectionNotes } from '@/lib/reporting/projectionPdf';

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

  it('splits the year into first half and back half', () => {
    const now = new Date(2026, 9, 15);
    const actual = cells([70, 85, 100, 115, 140, 170, 250, 190, 130, 40, 0, 0].map((n) => n * 1000));
    const r = projectYear(actual, PRIOR, 2026, now);
    // H1 + H2 should reconcile with the whole-year series (within rounding).
    const whole = r.months.reduce((s, m) => s + m.projected, 0);
    expect(Math.abs(r.firstHalf + r.backHalf - whole)).toBeLessThanOrEqual(2);
    // This office is summer-heavy, so the back half (Jul–Dec) outweighs H1.
    expect(r.backHalf).toBeGreaterThan(r.firstHalf);
  });

  it('builds a forward plan for a future year grown by the trend', () => {
    // 2025 full = 1.5M, base (2026) = 1.8M → +20% trend carried into 2027.
    const plan = projectFutureYear({
      year: 2027,
      baseAnnualGross: 1_800_000,
      baseAnnualDeals: 180,
      priorYearGross: 1_500_000,
      shape: [80, 90, 110, 120, 150, 180, 260, 200, 140, 120, 100, 90],
    });
    expect(plan.isFuture).toBe(true);
    expect(plan.growthPct).toBe(20);
    expect(plan.fullYear.expected).toBe(Math.round(1_800_000 * 1.2)); // 2.16M
    // Flat (low) ≤ expected ≤ stretch (high); here flat = base, stretch = +40%.
    expect(plan.fullYear.low).toBe(1_800_000);
    expect(plan.fullYear.high).toBe(Math.round(1_800_000 * 1.4));
    expect(plan.firstHalf + plan.backHalf).toBeGreaterThan(0);
    expect(plan.backHalf).toBeGreaterThan(plan.firstHalf); // seasonal shape preserved
  });

  it('honours an explicit growth override and clamps absurd values', () => {
    const base = { year: 2027, baseAnnualGross: 1_000_000, baseAnnualDeals: 100, priorYearGross: 1_000_000, shape: new Array(12).fill(1) };
    expect(projectFutureYear({ ...base, growthPct: 10 }).fullYear.expected).toBe(1_100_000);
    expect(projectFutureYear({ ...base, growthPct: 999 }).growthPct).toBe(100); // clamped to +100%
  });

  it('renders a valid PDF for a future-year plan', async () => {
    const plan = projectFutureYear({
      year: 2027, baseAnnualGross: 1_800_000, baseAnnualDeals: 180, priorYearGross: 1_500_000,
      shape: [80, 90, 110, 120, 150, 180, 260, 200, 140, 120, 100, 90],
    });
    const notes = projectionNotes(plan, (k: string) => k); // stub translator
    const bytes = await buildProjectionPdf(plan, { brandName: 'Georgian Water & Air', scopeLabel: 'All offices', generated: 'October 26, 2026', footer: 'GWA', notes });
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-'); // real PDF header
  });
});
