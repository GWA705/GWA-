import { describe, it, expect } from 'vitest';
import { leadSla } from '@/lib/leadSla';

const now = new Date('2026-10-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe('leadSla', () => {
  it('a fresh NEW lead under 24h has no SLA flag', () => {
    expect(leadSla({ createdAt: hoursAgo(5), status: 'NEW', now })).toBeNull();
    expect(leadSla({ createdAt: hoursAgo(23), status: 'NEW', now })).toBeNull();
  });

  it('flags DUE_SOON between 24 and 48 hours', () => {
    const s = leadSla({ createdAt: hoursAgo(30), status: 'NEW', now });
    expect(s?.state).toBe('DUE_SOON');
    expect(s?.tone).toBe('amber');
    expect(s?.label).toContain('30h');
  });

  it('flags OVERDUE past 48 hours, in days', () => {
    const s = leadSla({ createdAt: hoursAgo(60), status: 'NEW', now });
    expect(s?.state).toBe('OVERDUE');
    expect(s?.tone).toBe('red');
    expect(s?.label).toContain('2d');
  });

  it('stops the clock once the lead is worked (contacted / no-good)', () => {
    expect(leadSla({ createdAt: hoursAgo(72), status: 'CONTACTED', now })).toBeNull();
    expect(leadSla({ createdAt: hoursAgo(72), status: 'NO_GOOD', now })).toBeNull();
  });

  it('stops the clock when a booker has taken it (bookingStatus set)', () => {
    expect(leadSla({ createdAt: hoursAgo(72), status: 'NEW', bookingStatus: 'WORKING', now })).toBeNull();
    expect(leadSla({ createdAt: hoursAgo(72), status: 'NEW', bookingStatus: 'BOOKED', now })).toBeNull();
  });

  it('accepts an ISO string and respects custom thresholds', () => {
    const s = leadSla({ createdAt: hoursAgo(10).toISOString(), status: 'NEW', now, warnHours: 8, overdueHours: 16 });
    expect(s?.state).toBe('DUE_SOON');
  });

  it('returns null for an unparseable date', () => {
    expect(leadSla({ createdAt: 'not-a-date', status: 'NEW', now })).toBeNull();
  });
});
