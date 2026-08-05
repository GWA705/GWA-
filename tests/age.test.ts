import { describe, it, expect } from 'vitest';
import { ageInYears, isAdult, maxAdultDob, MIN_APPLICANT_AGE } from '@/lib/validation';

const today = new Date('2026-08-05T12:00:00');

describe('ageInYears', () => {
  it('computes whole years, respecting month/day', () => {
    expect(ageInYears('2000-08-05', today)).toBe(26);
    expect(ageInYears('2008-08-05', today)).toBe(18); // exactly 18 today
    expect(ageInYears('2008-08-06', today)).toBe(17); // 18th birthday is tomorrow
  });

  it('returns null for an unparseable date', () => {
    expect(ageInYears('not-a-date', today)).toBeNull();
  });
});

describe('isAdult', () => {
  it('is true for a clearly-adult birthdate and false for a child born this year', () => {
    expect(isAdult('1990-01-01')).toBe(true);
    expect(isAdult(`${new Date().getFullYear()}-01-01`)).toBe(false);
  });
});

describe('maxAdultDob', () => {
  it('is exactly the minimum age before the given day', () => {
    expect(maxAdultDob(new Date('2026-08-05T00:00:00'))).toBe('2008-08-05');
    expect(MIN_APPLICANT_AGE).toBe(18);
  });
});
