import { describe, it, expect } from 'vitest';
import { colLetter, matchTab } from '../src/lib/journal';

describe('colLetter', () => {
  it('maps 0-based indexes to A1 letters', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(25)).toBe('Z');
    expect(colLetter(26)).toBe('AA');
    expect(colLetter(27)).toBe('AB');
    expect(colLetter(51)).toBe('AZ');
  });
});

describe('matchTab', () => {
  const d = (y: number, m: number) => new Date(Date.UTC(y, m, 15));

  it('matches the journal naming variants for the right month + year', () => {
    const tabs = ['Jan.2026', 'Feb.2026', 'Jul.2026', 'Aug.2026'];
    expect(matchTab(tabs, d(2026, 6))).toBe('Jul.2026'); // July
    expect(matchTab(tabs, d(2026, 0))).toBe('Jan.2026');
  });

  it('tolerates full month names and 2-digit years', () => {
    expect(matchTab(['July 2026'], d(2026, 6))).toBe('July 2026');
    expect(matchTab(['Jul 26'], d(2026, 6))).toBe('Jul 26');
  });

  it('does not match the wrong year', () => {
    expect(matchTab(['Jul.2025'], d(2026, 6))).toBeNull();
    expect(matchTab(['Aug.2026'], d(2026, 6))).toBeNull();
  });
});
