import { describe, it, expect } from 'vitest';
import { buildSoldPayloadFrom, type SoldAppRecord } from '../src/lib/bookingSold';

const base: SoldAppRecord = {
  id: 'app_1',
  applicantFirstName: 'Jane',
  applicantLastName: 'Doe',
  applicantEmail: 'jane@example.com',
  applicantPhone: '705-555-0100',
  applicantCity: 'Orillia',
  applicantPostal: 'L3V 1A1',
  province: 'ON',
  address: '12 Lake St',
  coApplicantName: 'John Doe',
  productsSold: ['Reverse Osmosis', 'Whole Home Carbon'],
};

describe('buildSoldPayloadFrom — Application → booking sold-customer payload', () => {
  it('maps the customer, co-applicant→spouse, and zips product names to their journal codes', () => {
    const soldAt = new Date('2026-05-14T12:00:00.000Z');
    const payload = buildSoldPayloadFrom(base, ['RO', 'WHCCF'], soldAt);
    expect(payload).toEqual({
      applicationId: 'app_1',
      name: 'Jane Doe',
      phone: '705-555-0100',
      email: 'jane@example.com',
      address: '12 Lake St',
      city: 'Orillia',
      province: 'ON',
      postalCode: 'L3V 1A1',
      spouseName: 'John Doe', // the co-applicant is the household co-owner
      soldAt: '2026-05-14T12:00:00.000Z',
      products: [
        { sku: 'RO', name: 'Reverse Osmosis' },
        { sku: 'WHCCF', name: 'Whole Home Carbon' },
      ],
    });
  });

  it('leaves sku null when no journal code is known for a product', () => {
    const payload = buildSoldPayloadFrom({ ...base, productsSold: ['Mystery Unit'] }, [], null);
    expect(payload.products).toEqual([{ sku: null, name: 'Mystery Unit' }]);
    expect(payload.soldAt).toBeNull();
  });

  it('has no products when the deal sold none', () => {
    const payload = buildSoldPayloadFrom({ ...base, productsSold: [] }, [], null);
    expect(payload.products).toEqual([]);
  });

  it('nulls the name when there is no first or last name', () => {
    const payload = buildSoldPayloadFrom(
      { ...base, applicantFirstName: '', applicantLastName: '' },
      [],
      null,
    );
    expect(payload.name).toBeNull();
  });

  it('passes a missing co-applicant through as no spouse', () => {
    const payload = buildSoldPayloadFrom({ ...base, coApplicantName: null }, ['RO', 'WHCCF'], null);
    expect(payload.spouseName).toBeNull();
  });
});
