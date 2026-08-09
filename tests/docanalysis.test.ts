import { describe, it, expect } from 'vitest';
import { findDates } from '@/lib/docanalysis';
import { summarizeAnalysis, DOC_ANALYSIS_VERSION, type DocAnalysis } from '@/lib/docanalysis-format';

describe('findDates', () => {
  it('finds ISO, numeric, and month-name dates and de-dupes', () => {
    const text = 'Signed 2026-08-09 on 08/09/2026 — also August 9, 2026 and again 2026-08-09.';
    const dates = findDates(text);
    expect(dates).toContain('2026-08-09');
    expect(dates).toContain('08/09/2026');
    expect(dates.some((d) => /August 9, 2026/i.test(d))).toBe(true);
    // de-duped
    expect(dates.filter((d) => d === '2026-08-09')).toHaveLength(1);
  });

  it('returns nothing when there are no dates', () => {
    expect(findDates('no dates here at all')).toEqual([]);
  });
});

function make(overrides: Partial<DocAnalysis>): DocAnalysis {
  return {
    version: DOC_ANALYSIS_VERSION,
    analyzedAt: '2026-08-09T00:00:00.000Z',
    kind: 'pdf',
    pages: 3,
    hasTextLayer: true,
    scanned: false,
    dates: [],
    datePages: [],
    lowTextPages: [],
    eSignatures: 0,
    digitallySigned: false,
    ...overrides,
  };
}

describe('summarizeAnalysis', () => {
  it('shows page count and a found date', () => {
    const chips = summarizeAnalysis(make({ pages: 6, dates: ['2026-08-09'] }));
    expect(chips.find((c) => c.label === '6 pages')).toBeTruthy();
    expect(chips.find((c) => c.label.includes('2026-08-09') && c.tone === 'good')).toBeTruthy();
  });

  it('warns when a text PDF has no date', () => {
    const chips = summarizeAnalysis(make({ dates: [], hasTextLayer: true }));
    expect(chips.find((c) => c.label === 'No date found' && c.tone === 'warn')).toBeTruthy();
  });

  it('flags e-signed and scans', () => {
    expect(summarizeAnalysis(make({ digitallySigned: true })).some((c) => c.label === '✓ e-signed')).toBe(true);
    expect(summarizeAnalysis(make({ scanned: true, hasTextLayer: false })).some((c) => c.label.startsWith('Scan'))).toBe(true);
  });

  it('returns nothing for a missing/garbage blob', () => {
    expect(summarizeAnalysis(null)).toEqual([]);
    expect(summarizeAnalysis('nope')).toEqual([]);
  });
});
