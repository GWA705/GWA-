import { describe, it, expect } from 'vitest';
import { catchUpSince } from '@/lib/catchUp';

const DAY = 86_400_000;

describe('catchUpSince', () => {
  const now = new Date('2026-10-05T13:00:00Z'); // a Monday

  it('defaults to the last 24h when never cleared', () => {
    expect(catchUpSince(null, now).getTime()).toBe(now.getTime() - DAY);
  });

  it('uses the last-cleared time when within a week (so a weekend is covered)', () => {
    const friday = new Date('2026-10-02T21:00:00Z'); // ~3 days back
    expect(catchUpSince(friday, now).getTime()).toBe(friday.getTime());
  });

  it('never looks back more than 7 days', () => {
    const longAgo = new Date('2026-09-01T00:00:00Z');
    expect(catchUpSince(longAgo, now).getTime()).toBe(now.getTime() - 7 * DAY);
  });

  it('handles a just-cleared digest (window is tiny, not negative)', () => {
    const aMinuteAgo = new Date(now.getTime() - 60_000);
    expect(catchUpSince(aMinuteAgo, now).getTime()).toBe(aMinuteAgo.getTime());
  });
});
