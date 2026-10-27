import { describe, it, expect } from 'vitest';
import { parseOfficeAddress, deriveEntuitiveProfile, mergeEntuitiveProfile } from '@/lib/idTag';

describe('parseOfficeAddress (Office directory → Entuitive boxes)', () => {
  it('splits a NS address with a unit', () => {
    expect(parseOfficeAddress('30 Damascus Road Unit 109, Bedford, NS, B4A0C1')).toEqual({
      street: '30', streetName: 'Damascus Road', unit: '109', city: 'Bedford', province: 'Nova Scotia', postal: 'B4A 0C1',
    });
  });

  it('splits a PE address with no unit', () => {
    expect(parseOfficeAddress('393 University Ave, Charlottetown, PE, C1A 4N4')).toEqual({
      street: '393', streetName: 'University Ave', city: 'Charlottetown', province: 'Prince Edward Island', postal: 'C1A 4N4',
    });
  });

  it('handles a province abbreviation attached to the city and a spaced postal', () => {
    expect(parseOfficeAddress('11 King St, Barrie ON, L3C 3H6')).toMatchObject({
      street: '11', streetName: 'King St', city: 'Barrie', province: 'Ontario', postal: 'L3C 3H6',
    });
  });

  it('returns {} for an empty address and never throws', () => {
    expect(parseOfficeAddress('')).toEqual({});
    expect(parseOfficeAddress(null)).toEqual({});
  });
});

describe('deriveEntuitiveProfile + merge', () => {
  it('derives company/phone/service and splits the address', () => {
    const d = deriveEntuitiveProfile({ name: 'Aerus PEI', businessName: 'Aerus Water', address: '393 University Ave, Charlottetown, PE, C1A 4N4', phone: '902-894-8012' });
    expect(d.companyName).toBe('Aerus Water');
    expect(d.phone).toBe('902-894-8012');
    expect(d.service).toBe('Water Treatment (Home Depot Canada)');
    expect(d.city).toBe('Charlottetown');
    expect(d.province).toBe('Prince Edward Island');
  });

  it('a manually saved field overrides the directory-derived one', () => {
    const derived = deriveEntuitiveProfile({ name: 'Aerus PEI', businessName: 'Aerus Water', address: '393 University Ave, Charlottetown, PE, C1A 4N4', phone: '902-894-8012' });
    const merged = mergeEntuitiveProfile({ companyName: 'Georgian Water and Air — Charlottetown' }, derived);
    expect(merged.companyName).toBe('Georgian Water and Air — Charlottetown'); // saved wins
    expect(merged.city).toBe('Charlottetown'); // directory fills the rest
    expect(merged.phone).toBe('902-894-8012');
  });
});
