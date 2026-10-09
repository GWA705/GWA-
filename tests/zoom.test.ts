import { describe, it, expect } from 'vitest';
import { formatBytes } from '@/lib/zoom';

describe('formatBytes', () => {
  it('formats KB / MB / GB and blanks zero', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });
});
