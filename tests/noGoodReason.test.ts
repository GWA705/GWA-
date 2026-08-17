import { describe, it, expect } from 'vitest';
import { cleanNoGoodReason } from '@/lib/leads';

describe('cleanNoGoodReason', () => {
  it('keeps a plain reason unchanged', () => {
    expect(cleanNoGoodReason('Wrong number, out of area')).toBe('Wrong number, out of area');
  });

  it('strips pasted HD lead boilerplate, keeping only the reason', () => {
    const raw =
      'Request was for installation only. This office no longer performs third-party installations. ' +
      'New Home Depot Lead *IMPORTANT: Customers must be contacted within 24 hours of receiving this email.* ' +
      'Booking ID 701769355 Store 7116 Service Water Treatment Date Received 2026-08-15 12:54 Emergency? No';
    expect(cleanNoGoodReason(raw)).toBe(
      'Request was for installation only. This office no longer performs third-party installations.',
    );
  });

  it('cuts at a bare Booking ID marker', () => {
    expect(cleanNoGoodReason('Duplicate lead. Booking ID 12345 Store 7116')).toBe('Duplicate lead.');
  });

  it('trims trailing separators left by the cut', () => {
    expect(cleanNoGoodReason('Out of area — New Home Depot Lead blah')).toBe('Out of area');
  });

  it('leaves content that only looks boilerplate at the very start alone', () => {
    // No real reason precedes the marker → keep original rather than blanking.
    expect(cleanNoGoodReason('New Home Depot Lead xyz')).toBe('New Home Depot Lead xyz');
  });

  it('handles empty input', () => {
    expect(cleanNoGoodReason('')).toBe('');
  });
});
