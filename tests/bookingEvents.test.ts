import { describe, it, expect } from 'vitest';
import { normalizeBookingEvent, last4 } from '../src/lib/bookingEvents';

describe('last4', () => {
  it('pulls the last 4 digits, ignoring formatting', () => {
    expect(last4('705-555-0100')).toBe('0100');
    expect(last4('+1 (705) 555 0100')).toBe('0100');
    expect(last4('123')).toBeNull();
    expect(last4(null)).toBeNull();
  });
});

describe('normalizeBookingEvent', () => {
  it('normalises an appointment, taking occurredAt from ranAt over startAt', () => {
    const n = normalizeBookingEvent({
      eventId: 'evt_1',
      type: 'appointment',
      applicationId: 'lead_abc',
      phoneLast4: '0100',
      stage: 'ran',
      outcome: 'sold',
      startAt: '2026-05-10T18:00:00.000Z',
      ranAt: '2026-05-11T19:30:00.000Z',
      saleAmountCents: 499900,
    })!;
    expect(n.eventId).toBe('evt_1');
    expect(n.type).toBe('appointment');
    expect(n.portalRef).toBe('lead_abc');
    expect(n.phoneLast4).toBe('0100');
    expect(n.stage).toBe('ran');
    expect(n.outcome).toBe('sold');
    expect(n.occurredAt?.toISOString()).toBe('2026-05-11T19:30:00.000Z');
  });

  it('falls back to startAt when ranAt is absent', () => {
    const n = normalizeBookingEvent({ eventId: 'e', type: 'appointment', startAt: '2026-05-10T18:00:00.000Z' })!;
    expect(n.occurredAt?.toISOString()).toBe('2026-05-10T18:00:00.000Z');
  });

  it('takes install date and service date from their own fields', () => {
    expect(normalizeBookingEvent({ eventId: 'e', type: 'install', installDate: '2026-06-01' })!.occurredAt).toBeInstanceOf(Date);
    expect(normalizeBookingEvent({ eventId: 'e', type: 'service', date: '2026-07-02' })!.occurredAt).toBeInstanceOf(Date);
  });

  it('accepts optout (no occurredAt) and lower-cases the type', () => {
    const n = normalizeBookingEvent({ eventId: 'e', type: 'OptOut', channel: 'all', optedOut: true })!;
    expect(n.type).toBe('optout');
    expect(n.occurredAt).toBeNull();
  });

  it('rejects a missing eventId, missing type, or an unknown type', () => {
    expect(normalizeBookingEvent({ type: 'appointment' })).toBeNull();
    expect(normalizeBookingEvent({ eventId: 'e' })).toBeNull();
    expect(normalizeBookingEvent({ eventId: 'e', type: 'nonsense' })).toBeNull();
  });
});
