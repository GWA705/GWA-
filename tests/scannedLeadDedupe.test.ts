import { describe, it, expect } from 'vitest';
import { scannedLeadDedupeKey } from '@/lib/scannedLeadDedupe';

describe('scanned-lead duplicate key', () => {
  it('keys on phone regardless of formatting', () => {
    const a = scannedLeadDedupeKey({ phone: '(204) 555-1234', customerName: 'Betty Bray', storeNumber: '7054' });
    const b = scannedLeadDedupeKey({ phone: '204.555.1234', customerName: 'B. Bray', storeNumber: '7999' });
    const c = scannedLeadDedupeKey({ phone: '1 204 555 1234', customerName: 'Betty Bray' }); // leading country code
    expect(a).toBe('p:2045551234');
    expect(b).toBe('p:2045551234'); // same number, different name/store → still a dup
    expect(c).toBe('p:2045551234'); // last 10 digits
  });

  it('falls back to name + store when there is no usable phone', () => {
    expect(scannedLeadDedupeKey({ customerName: '  Betty   Bray ', storeNumber: ' 7054 ' })).toBe('n:betty bray|s:7054');
    expect(scannedLeadDedupeKey({ customerName: 'Betty Bray' })).toBe('n:betty bray|s:');
    expect(scannedLeadDedupeKey({ phone: '12', customerName: 'Betty Bray', storeNumber: '7054' })).toBe('n:betty bray|s:7054'); // junk phone ignored
  });

  it('is null only when there is neither name nor phone', () => {
    expect(scannedLeadDedupeKey({})).toBeNull();
    expect(scannedLeadDedupeKey({ phone: '', customerName: '' })).toBeNull();
  });

  it('different people do not collide', () => {
    expect(scannedLeadDedupeKey({ customerName: 'Lee', storeNumber: '7180' }))
      .not.toBe(scannedLeadDedupeKey({ customerName: 'Lee', storeNumber: '7057' }));
  });
});
