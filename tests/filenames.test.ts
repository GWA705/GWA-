import { describe, it, expect } from 'vitest';
import { friendlyFileName } from '@/lib/filenames';

describe('friendlyFileName', () => {
  it('replaces an opaque iOS UUID name but keeps the extension', () => {
    expect(friendlyFileName('632D9D1F-C6D6-4C96-87AE-1234567890D5.pdf')).toBe('Attachment.pdf');
    expect(friendlyFileName('632D9D1F-C6D6-4C96-87AE-1234567890D5.pdf', 2)).toBe('Attachment 3.pdf');
  });

  it('replaces a long bare-hex name', () => {
    expect(friendlyFileName('a1b2c3d4e5f60718293a4b5c.jpeg')).toBe('Attachment.jpeg');
  });

  it('leaves descriptive names untouched', () => {
    expect(friendlyFileName('Promo_Sheet_2026.pdf')).toBe('Promo_Sheet_2026.pdf');
    expect(friendlyFileName('Payout Receipt.pdf')).toBe('Payout Receipt.pdf');
    expect(friendlyFileName('invoice-1042.pdf')).toBe('invoice-1042.pdf');
  });

  it('handles names without an extension', () => {
    expect(friendlyFileName('632D9D1F-C6D6-4C96-87AE-1234567890D5')).toBe('Attachment');
  });
});
