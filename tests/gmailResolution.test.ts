import { describe, it, expect } from 'vitest';
import { parseHdCaseNumber, parseHdSubject } from '@/lib/gmailResolution';

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

describe('parseHdSubject (pre-fill a case from a real HD subject)', () => {
  it('pulls case #, name, store and HD Ref # from a LEAD-style subject', () => {
    const r = parseHdSubject('CASE #08210415 ON DUPRE 7133 LEAD #800254246 WATER TREATMENT SYSTEM GEORGIAN WATER');
    expect(r).toEqual({ caseNumber: '08210415', hdRef: '800254246', lastName: 'DUPRE', store: '7133' });
  });

  it('handles a province-code prefix and a lead # with no "LEAD" word', () => {
    const r = parseHdSubject('RE: CASE #08156921 AB HOETMER 7172 800199305 WATER TREATMENT - 24 MONTH NO INTEREST');
    expect(r.lastName).toBe('HOETMER');
    expect(r.store).toBe('7172');
    expect(r.hdRef).toBe('800199305');
    expect(r.caseNumber).toBe('08156921');
  });

  it('ignores a non-800 order number (not an HD Ref #)', () => {
    const r = parseHdSubject('RE: SEPT 5 - MOD - CASE #08191786 ON MUZZZEL 7154 ORDER 611544165 WATER TREATMENT');
    expect(r.lastName).toBe('MUZZZEL');
    expect(r.store).toBe('7154');
    expect(r.hdRef).toBeNull(); // 611544165 is an order #, not an 800… ref
  });

  it('returns nulls for the parts a subject omits', () => {
    const r = parseHdSubject('Re: [EXTERNAL] Re: Filtration Documentation case# 08127259');
    expect(r.caseNumber).toBe('08127259');
    expect(r.hdRef).toBeNull();
    expect(r.lastName).toBeNull();
    expect(r.store).toBeNull();
  });
});
