import { describe, it, expect } from 'vitest';
import { latestOutcome } from '@/lib/reporting/leadsReport';

describe('latestOutcome', () => {
  it('is "notCalled" when there are no calls', () => {
    expect(latestOutcome([])).toBe('notCalled');
  });

  it('maps each outcome to its bucket', () => {
    expect(latestOutcome([{ outcome: 'NO_ANSWER' }])).toBe('na');
    expect(latestOutcome([{ outcome: 'LEFT_MESSAGE' }])).toBe('lm');
    expect(latestOutcome([{ outcome: 'SPOKE' }])).toBe('spoke');
    expect(latestOutcome([{ outcome: 'BOOKED' }])).toBe('booked');
    expect(latestOutcome([{ outcome: 'SOLD' }])).toBe('sold');
    expect(latestOutcome([{ outcome: 'NOT_INTERESTED' }])).toBe('ni');
  });

  it('uses the latest call outcome', () => {
    expect(latestOutcome([{ outcome: 'NO_ANSWER' }, { outcome: 'BOOKED' }])).toBe('booked');
  });

  it('looks past a trailing NOTE to the last real outcome', () => {
    expect(latestOutcome([{ outcome: 'SOLD' }, { outcome: 'NOTE' }])).toBe('sold');
    expect(latestOutcome([{ outcome: 'NOTE' }])).toBe('notCalled');
  });
});
