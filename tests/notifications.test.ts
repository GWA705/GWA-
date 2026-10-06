import { describe, it, expect } from 'vitest';
import { applicationIdFromUrl } from '../src/lib/notifications';

describe('applicationIdFromUrl', () => {
  it('pulls the id from a staff deal link', () => {
    expect(applicationIdFromUrl('/staff/applications/ckAbc123')).toBe('ckAbc123');
  });
  it('pulls the id from a dealer deal link', () => {
    expect(applicationIdFromUrl('/dealer/applications/xyz789')).toBe('xyz789');
  });
  it('returns null for non-deal links (mail, gift cards, leads)', () => {
    expect(applicationIdFromUrl('/staff/mail/abc')).toBeNull();
    expect(applicationIdFromUrl('/dealer/gift-cards')).toBeNull();
    expect(applicationIdFromUrl('/dealer/leads')).toBeNull();
    expect(applicationIdFromUrl('/staff')).toBeNull();
  });
  it('ignores the "new" application route and blanks', () => {
    expect(applicationIdFromUrl('/dealer/applications/new')).toBeNull();
    expect(applicationIdFromUrl(null)).toBeNull();
    expect(applicationIdFromUrl(undefined)).toBeNull();
    expect(applicationIdFromUrl('')).toBeNull();
  });
});
