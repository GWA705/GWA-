import { describe, it, expect } from 'vitest';
import { journalCodeFromName } from '../src/lib/journalCode';

describe('journalCodeFromName', () => {
  it('takes the first letter of each word, uppercased', () => {
    expect(journalCodeFromName('Pure and Clean')).toBe('PAC');
    expect(journalCodeFromName('City Soft')).toBe('CS');
    expect(journalCodeFromName('softener')).toBe('S');
  });
  it('keeps digits and strips punctuation', () => {
    expect(journalCodeFromName('7 Stage Drinking Station')).toBe('7SDS');
    expect(journalCodeFromName('Whole-Home Carbon')).toBe('WC'); // hyphen stripped within the word; only spaces split words
  });
  it('collapses extra spaces and handles empties', () => {
    expect(journalCodeFromName('  Reverse   Osmosis ')).toBe('RO');
    expect(journalCodeFromName('')).toBe('');
  });
});
