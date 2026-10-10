import { describe, it, expect } from 'vitest';
import {
  parseWorkdays,
  serializeWorkdays,
  localWeekday,
  isWorkday,
  workdaysLabel,
  DEFAULT_WORKDAYS,
} from '@/lib/businessDays';

describe('parseWorkdays', () => {
  it('defaults to Mon–Fri when unset/blank', () => {
    expect(parseWorkdays(undefined)).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(parseWorkdays('')).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(parseWorkdays(null)).toEqual(new Set(DEFAULT_WORKDAYS));
  });

  it('parses a comma list and ignores junk / out-of-range', () => {
    expect(parseWorkdays('1,3,5')).toEqual(new Set([1, 3, 5]));
    expect(parseWorkdays('0, 6')).toEqual(new Set([0, 6]));
    expect(parseWorkdays('1,x,9,-2,4')).toEqual(new Set([1, 4]));
  });

  it('falls back to default if nothing valid parses', () => {
    expect(parseWorkdays('9,10')).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});

describe('serializeWorkdays', () => {
  it('sorts, dedupes and drops out-of-range', () => {
    expect(serializeWorkdays([5, 1, 3, 1])).toBe('1,3,5');
    expect(serializeWorkdays([6, 0])).toBe('0,6');
    expect(serializeWorkdays([1, 9, -1, 4])).toBe('1,4');
  });

  it('round-trips through parseWorkdays', () => {
    const s = serializeWorkdays([1, 2, 3, 4, 5]);
    expect(parseWorkdays(s)).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});

describe('localWeekday', () => {
  // 2024-01-01 is a Monday; 2024-01-06 Saturday; 2024-01-07 Sunday.
  it('returns the weekday in the given timezone', () => {
    expect(localWeekday(new Date('2024-01-01T12:00:00Z'), 'America/Toronto')).toBe(1); // Mon
    expect(localWeekday(new Date('2024-01-06T12:00:00Z'), 'America/Toronto')).toBe(6); // Sat
    expect(localWeekday(new Date('2024-01-07T12:00:00Z'), 'America/Toronto')).toBe(0); // Sun
  });

  it('respects the timezone across the day boundary', () => {
    // Monday 00:30 UTC is still Sunday 19:30 in Toronto (EST, -5).
    const d = new Date('2024-01-01T00:30:00Z');
    expect(localWeekday(d, 'America/Toronto')).toBe(0); // Sun in Toronto
    expect(localWeekday(d, 'UTC')).toBe(1); // Mon in UTC
  });
});

describe('isWorkday', () => {
  const monFri = new Set([1, 2, 3, 4, 5]);
  it('is true on weekdays, false on the weekend (Mon–Fri)', () => {
    expect(isWorkday(new Date('2024-01-01T15:00:00Z'), 'America/Toronto', monFri)).toBe(true); // Mon
    expect(isWorkday(new Date('2024-01-06T15:00:00Z'), 'America/Toronto', monFri)).toBe(false); // Sat
    expect(isWorkday(new Date('2024-01-07T15:00:00Z'), 'America/Toronto', monFri)).toBe(false); // Sun
  });

  it('honours a custom day set (e.g. include Saturday)', () => {
    const withSat = new Set([1, 2, 3, 4, 5, 6]);
    expect(isWorkday(new Date('2024-01-06T15:00:00Z'), 'America/Toronto', withSat)).toBe(true); // Sat
    expect(isWorkday(new Date('2024-01-07T15:00:00Z'), 'America/Toronto', withSat)).toBe(false); // Sun
  });
});

describe('workdaysLabel', () => {
  it('collapses a contiguous run', () => {
    expect(workdaysLabel(new Set([1, 2, 3, 4, 5]))).toBe('Mon–Fri');
    expect(workdaysLabel(new Set([1, 2, 3]))).toBe('Mon–Wed');
  });
  it('lists non-contiguous days', () => {
    expect(workdaysLabel(new Set([1, 3, 5]))).toBe('Mon, Wed, Fri');
  });
  it('handles the extremes', () => {
    expect(workdaysLabel(new Set())).toBe('no days');
    expect(workdaysLabel(new Set([0, 1, 2, 3, 4, 5, 6]))).toBe('every day');
  });
});
