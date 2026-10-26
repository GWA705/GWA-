/**
 * Sales PROJECTION — a year-end revenue estimate built on the SAME money as the
 * Total Sales / Monthly office reports (OK deals, dated by Date Paid, gross),
 * so the actuals always reconcile with the reports the team already trusts.
 * (The journal read + office scoping live in salesProjectionData.ts; this file
 * is pure math so it can be unit-tested on its own.)
 *
 * The method is deliberately plain and honest (see projectYear):
 *   • completed months are banked actuals,
 *   • the rest of the year is estimated by scaling those actuals to a full year,
 *     weighted by the prior year's seasonal shape (so a July-heavy year isn't
 *     projected as if every month were average),
 *   • the result is a range (low / expected / high) derived three independent
 *     ways, not a single false-precision number.
 *
 * It is an estimate, not a promise, and it says so.
 */

export interface MonthCell {
  gross: number;
  count: number;
}

// ---------------------------------------------------------------------------
// Pure projection math (no I/O — unit-tested directly)
// ---------------------------------------------------------------------------

export interface ProjectedMonth {
  index: number; // 0-11
  label: string; // 'Jan'
  actual: number; // banked gross (0 for a not-yet-started month)
  actualCount: number;
  projected: number; // estimated gross for the whole month (= actual once complete)
  projectedCount: number;
  isProjected: boolean; // the month is partly/fully estimated
  isPartial: boolean; // the current, in-progress month
}

export interface Band {
  low: number;
  expected: number;
  high: number;
}

export interface ProjectionResult {
  year: number;
  seasonal: boolean; // did we have a prior year to shape the estimate?
  priorYearTotal: number;
  completedMonths: number; // fully-elapsed months of this year
  ytd: number; // banked gross so far (completed + current-month-to-date)
  ytdCount: number;
  runRateMonthly: number; // avg gross per completed month
  fullYear: Band; // projected full-year gross (low/expected/high)
  fullYearDeals: number; // projected full-year paid deals (expected)
  remainingGross: number; // expected − banked-to-date
  months: ProjectedMonth[];
  firstHalf: number; // Jan–Jun gross (actual + projected)
  backHalf: number; // Jul–Dec gross
  firstHalfDeals: number;
  backHalfDeals: number;
  confidence: 'higher' | 'moderate' | 'lower';
  isComplete: boolean; // the whole year is in the past → actuals are final
  isFuture: boolean; // a forward plan for a year that hasn't started
  growthPct: number; // the year-over-year growth assumption used (future years)
}

function halves(months: ProjectedMonth[]): Pick<ProjectionResult, 'firstHalf' | 'backHalf' | 'firstHalfDeals' | 'backHalfDeals'> {
  const h1 = months.slice(0, 6);
  const h2 = months.slice(6);
  return {
    firstHalf: Math.round(h1.reduce((s, m) => s + m.projected, 0)),
    backHalf: Math.round(h2.reduce((s, m) => s + m.projected, 0)),
    firstHalfDeals: h1.reduce((s, m) => s + m.projectedCount, 0),
    backHalfDeals: h2.reduce((s, m) => s + m.projectedCount, 0),
  };
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sum(a: number[]): number {
  return a.reduce((s, n) => s + n, 0);
}

export function projectYear(
  actual: MonthCell[],
  prior: MonthCell[],
  year: number,
  now: Date = new Date(),
): ProjectionResult {
  const gross = actual.map((m) => m.gross);
  const counts = actual.map((m) => m.count);
  const priorGross = prior.map((m) => m.gross);

  // How much of the year has elapsed.
  let currentIdx: number; // the in-progress month (0-11), or 12 if the year is past, or 0 if future
  if (year < now.getFullYear()) currentIdx = 12;
  else if (year > now.getFullYear()) currentIdx = 0;
  else currentIdx = now.getMonth();
  const completed = Math.min(12, currentIdx); // months fully in the past
  const isComplete = completed >= 12;

  const priorYearTotal = sum(priorGross);
  const seasonal = priorYearTotal > 0;
  const share = seasonal ? priorGross.map((g) => g / priorYearTotal) : priorGross.map(() => 1 / 12);

  const ytdCompleted = sum(gross.slice(0, completed));
  const ytdCompletedCount = sum(counts.slice(0, completed));
  const partialGross = completed < 12 ? gross[completed] : 0;
  const partialCount = completed < 12 ? counts[completed] : 0;
  const ytd = ytdCompleted + partialGross;
  const ytdCount = ytdCompletedCount + partialCount;
  const runRateMonthly = completed > 0 ? ytdCompleted / completed : 0;

  // --- Three independent full-year estimates, on completed months only. ---
  const fracCompleted = sum(share.slice(0, completed)); // seasonal fraction banked
  const estSeasonal = seasonal && fracCompleted > 0 ? ytdCompleted / fracCompleted : NaN;
  const estFlat = completed > 0 ? runRateMonthly * 12 : NaN;
  const priorThroughCompleted = sum(priorGross.slice(0, completed));
  const estPrior = seasonal && priorThroughCompleted > 0
    ? priorYearTotal * (ytdCompleted / priorThroughCompleted)
    : NaN;

  const candidates = [estSeasonal, estFlat, estPrior].filter((n) => Number.isFinite(n) && n > 0) as number[];

  let band: Band;
  if (isComplete) {
    const final = sum(gross);
    band = { low: final, expected: final, high: final };
  } else if (candidates.length === 0) {
    band = { low: 0, expected: 0, high: 0 };
  } else {
    const expected = Number.isFinite(estSeasonal) && estSeasonal > 0 ? estSeasonal : estFlat;
    let low = Math.min(...candidates);
    let high = Math.max(...candidates);
    if (candidates.length === 1) {
      // Only one way to estimate (no prior year): widen by month-to-month
      // volatility so the band isn't fake-tight.
      const vals = gross.slice(0, completed);
      const mean = runRateMonthly || 1;
      const variance = completed > 1 ? sum(vals.map((v) => (v - mean) ** 2)) / completed : 0;
      const cv = Math.min(0.4, Math.sqrt(variance) / mean || 0.1);
      low = expected * (1 - cv);
      high = expected * (1 + cv);
    }
    band = { low: Math.round(low), expected: Math.round(expected), high: Math.round(expected + (high - expected)) };
    band.low = Math.round(Math.min(low, expected));
    band.high = Math.round(Math.max(high, expected));
    // Never project a full year below what's already banked.
    band.expected = Math.max(band.expected, Math.round(ytd));
    band.high = Math.max(band.high, band.expected);
    band.low = Math.min(band.low, band.expected);
    band.low = Math.max(band.low, Math.round(ytd));
  }

  // --- Distribute the remaining expected gross across the rest of the year. ---
  const remaining = Math.max(0, band.expected - ytdCompleted);
  const tail = [];
  for (let m = completed; m < 12; m += 1) tail.push(m);
  const tailWeight = tail.map((m) => (seasonal ? share[m] : 1));
  const tailWeightSum = sum(tailWeight) || 1;

  // Deals: same shape, scaled from the banked count.
  const dealsCompletedFrac = seasonal && fracCompleted > 0 ? fracCompleted : (completed > 0 ? completed / 12 : 0);
  const fullYearDeals = isComplete
    ? sum(counts)
    : dealsCompletedFrac > 0
      ? Math.round(ytdCompletedCount / dealsCompletedFrac)
      : 0;
  const remainingDeals = Math.max(0, fullYearDeals - ytdCompletedCount);

  const months: ProjectedMonth[] = [];
  for (let m = 0; m < 12; m += 1) {
    const past = m < completed;
    const partial = m === completed && !isComplete;
    const future = m > completed;
    let projected = gross[m];
    let projectedCount = counts[m];
    if (!past && !isComplete) {
      const w = (seasonal ? share[m] : 1) / tailWeightSum;
      const est = remaining * w;
      const estCount = remainingDeals * w;
      if (partial) {
        // Current month: at least what's banked, at most the fuller estimate.
        projected = Math.max(gross[m], Math.round(est));
        projectedCount = Math.max(counts[m], Math.round(estCount));
      } else {
        projected = Math.round(est);
        projectedCount = Math.round(estCount);
      }
    }
    months.push({
      index: m,
      label: MONTH_ABBR[m],
      actual: gross[m],
      actualCount: counts[m],
      projected,
      projectedCount,
      isProjected: (partial || future) && !isComplete,
      isPartial: partial,
    });
  }

  // Confidence: more prior history + more banked months ⇒ steadier estimate.
  let confidence: ProjectionResult['confidence'] = 'lower';
  if (seasonal && completed >= 6) confidence = 'higher';
  else if (seasonal || completed >= 6) confidence = 'moderate';

  return {
    year,
    seasonal,
    priorYearTotal,
    completedMonths: completed,
    ytd,
    ytdCount,
    runRateMonthly,
    fullYear: band,
    fullYearDeals,
    remainingGross: Math.max(0, band.expected - Math.round(ytd)),
    months,
    ...halves(months),
    confidence,
    isComplete,
    isFuture: false,
    growthPct: 0,
  };
}

/**
 * Forward-year PLAN (e.g. 2027) for a year with no sales yet. You can't measure
 * then scale, so this grows a base annual figure by a year-over-year trend and
 * distributes it across the year by the prior season's shape. Presented as a
 * Flat / Expected / Stretch range so it can be defended to a partner (Home Depot).
 */
export function projectFutureYear(args: {
  year: number;
  baseAnnualGross: number; // the base year's full-year total (actual, or its projection)
  baseAnnualDeals: number;
  priorYearGross: number; // the year before the base — for the growth trend (0 if unknown)
  shape: number[]; // 12 monthly weights (seasonality); normalized here
  growthPct?: number; // explicit override in %, e.g. 12 for +12%
}): ProjectionResult {
  const { year, baseAnnualGross, baseAnnualDeals, priorYearGross } = args;
  const rawShape = args.shape.slice(0, 12);
  const shapeSum = sum(rawShape);
  const shape = shapeSum > 0 ? rawShape.map((n) => n / shapeSum) : new Array(12).fill(1 / 12);

  // Growth: explicit override, else the observed base-vs-prior trend, clamped to
  // a sane planning band (−50%…+100%).
  const trend = priorYearGross > 0 ? baseAnnualGross / priorYearGross - 1 : 0;
  const g = Math.max(-0.5, Math.min(1, args.growthPct != null ? args.growthPct / 100 : trend));

  const expectedAnnual = baseAnnualGross * (1 + g);
  const gLow = Math.min(0, g); // flat if growing; the decline itself if shrinking
  const gHigh = g >= 0 ? g * 2 : 0; // stretch = trend continuing to compound
  const dealsAnnual = Math.round(baseAnnualDeals * (1 + g));

  const months: ProjectedMonth[] = [];
  for (let m = 0; m < 12; m += 1) {
    months.push({
      index: m,
      label: MONTH_ABBR[m],
      actual: 0,
      actualCount: 0,
      projected: Math.round(expectedAnnual * shape[m]),
      projectedCount: Math.round(dealsAnnual * shape[m]),
      isProjected: true,
      isPartial: false,
    });
  }

  return {
    year,
    seasonal: shapeSum > 0,
    priorYearTotal: baseAnnualGross,
    completedMonths: 0,
    ytd: 0,
    ytdCount: 0,
    runRateMonthly: expectedAnnual / 12,
    fullYear: {
      low: Math.round(Math.min(baseAnnualGross * (1 + gLow), expectedAnnual)),
      expected: Math.round(expectedAnnual),
      high: Math.round(Math.max(baseAnnualGross * (1 + gHigh), expectedAnnual)),
    },
    fullYearDeals: dealsAnnual,
    remainingGross: Math.round(expectedAnnual),
    months,
    ...halves(months),
    confidence: priorYearGross > 0 ? 'moderate' : 'lower',
    isComplete: false,
    isFuture: true,
    growthPct: Math.round(g * 100),
  };
}
