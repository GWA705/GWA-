import { describe, it, expect } from 'vitest';
import { directSaleSchema } from '@/lib/validation';

// A Direct sale as the form posts it: empty <select>/<input> fields post "".
const base = {
  dealerId: 'dealer_123',
  province: 'ON',
  programType: 'GWA',
  programCategory: 'WATER',
  requestedAmount: '5000',
  applicantFirstName: 'Jane',
  applicantLastName: 'Smith',
  applicantEmail: 'jane@example.com',
  applicantPhone: '705-555-0148',
  applicantAddress: '',
  city: 'Barrie',
  postalCode: 'L4N 1A1',
  dateOfSale: '2026-10-01',
  installationDate: '',
  paymentMethod: 'CASH',
  financeCompanyId: '',
  financeItNumber: '',
  hdReference: '',
  salespersonName: '',
  installerName: '',
  soapIncluded: '',
};

describe('directSaleSchema', () => {
  it('accepts a minimal valid walk-in cash sale', () => {
    const r = directSaleSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.dealerId).toBe('dealer_123');
      expect(r.data.paymentMethod).toBe('CASH');
      expect(r.data.dateOfSale).toBe('2026-10-01');
      expect(r.data.applicantFirstName).toBe('Jane'); // formatPersonName applied
    }
  });

  it('requires the sale date (it is also the paid date)', () => {
    const r = directSaleSchema.safeParse({ ...base, dateOfSale: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'dateOfSale')).toBe(true);
  });

  it('rejects an invalid sale date', () => {
    const r = directSaleSchema.safeParse({ ...base, dateOfSale: 'not-a-date' });
    expect(r.success).toBe(false);
  });

  it('requires an office (dealerId)', () => {
    const r = directSaleSchema.safeParse({ ...base, dealerId: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'dealerId')).toBe(true);
  });

  it('requires a payment source', () => {
    const r = directSaleSchema.safeParse({ ...base, paymentMethod: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === 'paymentMethod')).toBe(true);
  });

  it('carries the HD store id on an HD-program sale', () => {
    const r = directSaleSchema.safeParse({
      ...base,
      programType: 'HD',
      hdReference: '800255118',
      homeDepotStoreId: 'store_7247',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.homeDepotStoreId).toBe('store_7247');
  });

  it('treats an empty HD store as undefined (the action enforces it for HD)', () => {
    const r = directSaleSchema.safeParse({ ...base, homeDepotStoreId: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.homeDepotStoreId).toBeUndefined();
  });

  it('accepts a financed sale with a finance company + deal number', () => {
    const r = directSaleSchema.safeParse({
      ...base,
      paymentMethod: 'FINANCE_COMPANY',
      financeCompanyId: 'fc_1',
      financeItNumber: 'FIN-998877',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.financeCompanyId).toBe('fc_1');
      expect(r.data.financeItNumber).toBe('FIN-998877');
    }
  });
});
