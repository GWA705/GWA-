import { describe, it, expect } from 'vitest';
import { ageLevel } from '@/lib/resolutionStatus';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe('ageLevel (amber at 3 days, red at 7)', () => {
  it('open cases colour by age', () => {
    expect(ageLevel(daysAgo(1), 'OPEN')).toBe('none');
    expect(ageLevel(daysAgo(3), 'OPEN')).toBe('amber');
    expect(ageLevel(daysAgo(5), 'IN_PROGRESS')).toBe('amber');
    expect(ageLevel(daysAgo(7), 'WAITING_ON_OFFICE')).toBe('red');
    expect(ageLevel(daysAgo(20), 'ESCALATED_HD')).toBe('red');
  });

  it('resolved and closed cases never colour by age', () => {
    expect(ageLevel(daysAgo(30), 'RESOLVED')).toBe('none');
    expect(ageLevel(daysAgo(30), 'CLOSED')).toBe('none');
  });
});
