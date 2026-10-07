import { describe, it, expect } from 'vitest';
import { parseHdCaseNumber } from '@/lib/gmailResolution';

describe('parseHdCaseNumber (pull HD CASE # out of an email subject)', () => {
  it('reads a real HD resolution subject', () => {
    expect(parseHdCaseNumber('CASE #08210415 ON JANE SMITH BARRIE [LEAD #800255118]')).toBe('08210415');
  });

  it('tolerates spacing and casing around the #', () => {
    expect(parseHdCaseNumber('Re: case 08210415 — update')).toBe('08210415');
    expect(parseHdCaseNumber('Case#  08210415')).toBe('08210415');
  });

  it('keeps leading zeros (it is a string key, not a number)', () => {
    expect(parseHdCaseNumber('CASE #00099123 ON …')).toBe('00099123');
  });

  it('returns null when there is no case number', () => {
    expect(parseHdCaseNumber('Leak on the RO system')).toBeNull();
    expect(parseHdCaseNumber('')).toBeNull();
  });
});
