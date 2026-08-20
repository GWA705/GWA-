import { describe, it, expect } from 'vitest';
import { parseLeadName, parseLeadAddress, findLeadByBooking } from '../src/lib/leads';
import type { Lead } from '../src/lib/leads';

describe('parseLeadName', () => {
  it('splits "First Last"', () => {
    expect(parseLeadName('KEN DAVIS')).toEqual({ first: 'KEN', last: 'DAVIS' });
  });
  it('keeps multi-word last names', () => {
    expect(parseLeadName('Ken Van Der Berg')).toEqual({ first: 'Ken', last: 'Van Der Berg' });
  });
  it('handles "Last, First"', () => {
    expect(parseLeadName('Davis, Ken')).toEqual({ first: 'Ken', last: 'Davis' });
  });
  it('single word → first only', () => {
    expect(parseLeadName('Cher')).toEqual({ first: 'Cher', last: '' });
  });
});

describe('parseLeadAddress', () => {
  it('parses "street, city PROV, postal"', () => {
    expect(parseLeadAddress('1306 SPYGLASS POINT RD, RAMARA ON, L0K 1B0')).toEqual({
      street: '1306 SPYGLASS POINT RD',
      city: 'RAMARA',
      province: 'ON',
      postal: 'L0K 1B0',
    });
  });
  it('parses a comma-joined city/prov and mashed postal', () => {
    expect(parseLeadAddress('123 Main St, Barrie, ON L4N6B5')).toEqual({
      street: '123 Main St',
      city: 'Barrie',
      province: 'ON',
      postal: 'L4N 6B5',
    });
  });
  it('reads postal + province even without commas (city may be blank)', () => {
    const r = parseLeadAddress('55 King St Toronto ON M5H 1A1');
    expect(r.province).toBe('ON');
    expect(r.postal).toBe('M5H 1A1');
    expect(r.street).toContain('55 King St');
  });
  it('empty in → empty out', () => {
    expect(parseLeadAddress('')).toEqual({ street: '', city: '', province: '', postal: '' });
  });
});

describe('findLeadByBooking', () => {
  const leads = [
    { bookingId: '701770496', customerName: 'Ken Davis' },
    { bookingId: '#701 234 567', customerName: 'Jo Lee' },
  ] as Lead[];
  it('matches on digits only, ignoring punctuation/spacing', () => {
    expect(findLeadByBooking(leads, '701770496')?.customerName).toBe('Ken Davis');
    expect(findLeadByBooking(leads, '701-234-567')?.customerName).toBe('Jo Lee');
  });
  it('returns null for no match or too-short input', () => {
    expect(findLeadByBooking(leads, '999999999')).toBeNull();
    expect(findLeadByBooking(leads, '70')).toBeNull();
  });
});
