import { describe, it, expect } from 'vitest';
import { currentHourInTz, isBusinessHours } from '@/lib/sla';

describe('SLA business hours', () => {
  it('reports the correct Toronto hour (DST, summer = UTC-4)', () => {
    // 2026-07-31 13:00 UTC → 09:00 in Toronto (EDT).
    const summerMorning = new Date('2026-07-31T13:00:00Z');
    expect(currentHourInTz(summerMorning)).toBe(9);
    expect(isBusinessHours(summerMorning)).toBe(true);
  });

  it('is closed before 8am Toronto time', () => {
    // 2026-07-31 10:30 UTC → 06:30 Toronto.
    const earlyMorning = new Date('2026-07-31T10:30:00Z');
    expect(currentHourInTz(earlyMorning)).toBe(6);
    expect(isBusinessHours(earlyMorning)).toBe(false);
  });

  it('is closed at/after 10pm Toronto time', () => {
    // 2026-08-01 03:00 UTC → 23:00 (11pm) Toronto on 2026-07-31.
    const lateNight = new Date('2026-08-01T03:00:00Z');
    expect(currentHourInTz(lateNight)).toBe(23);
    expect(isBusinessHours(lateNight)).toBe(false);
  });

  it('is open at 9pm Toronto time (still before 10pm cutoff)', () => {
    // 2026-08-01 01:00 UTC → 21:00 (9pm) Toronto.
    const evening = new Date('2026-08-01T01:00:00Z');
    expect(currentHourInTz(evening)).toBe(21);
    expect(isBusinessHours(evening)).toBe(true);
  });

  it('handles standard time (winter = UTC-5)', () => {
    // 2026-01-15 13:00 UTC → 08:00 Toronto (EST) — right at open.
    const winterOpen = new Date('2026-01-15T13:00:00Z');
    expect(currentHourInTz(winterOpen)).toBe(8);
    expect(isBusinessHours(winterOpen)).toBe(true);
  });
});
