import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeDocLinkToken, readDocLinkToken, DOC_LINK_TTL_DAYS } from '@/lib/docLink';

describe('docLink tokens', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips a file id', () => {
    const token = makeDocLinkToken('file_abc123');
    expect(readDocLinkToken(token)).toEqual({ fileId: 'file_abc123' });
  });

  it('produces a URL-safe token (no spaces, slashes, plus or padding)', () => {
    const token = makeDocLinkToken('file_abc123');
    expect(token).not.toMatch(/[\s/+=]/);
  });

  it('rejects a tampered token', () => {
    const token = makeDocLinkToken('file_abc123');
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A');
    expect(readDocLinkToken(tampered)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(readDocLinkToken('not-a-real-token')).toBeNull();
    expect(readDocLinkToken('')).toBeNull();
  });

  it('expires after the TTL', () => {
    const token = makeDocLinkToken('file_abc123', 30);
    // Jump 31 days forward — past the 30-day expiry.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(readDocLinkToken(token)).toBeNull();
  });

  it('is still valid just inside the TTL', () => {
    const token = makeDocLinkToken('file_abc123', DOC_LINK_TTL_DAYS);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (DOC_LINK_TTL_DAYS - 1) * 24 * 60 * 60 * 1000);
    expect(readDocLinkToken(token)).toEqual({ fileId: 'file_abc123' });
  });
});
