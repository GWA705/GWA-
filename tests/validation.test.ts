import { describe, it, expect } from 'vitest';
import { applicationSchema } from '@/lib/validation';

// Minimal valid TYPED submission as the form actually posts it: every optional
// field present but blank (empty <select> options post "", empty inputs post "").
const baseForm = {
  entryMethod: 'TYPED',
  programType: 'GWA',
  programCategory: 'AIR',
  requestedAmount: '4200',
  financeItNumber: '',
  financingNote: '',
  loanReference: '',
  financeReference: '',
  hdReference: '',
  dateOfSale: '',
  installationDate: '',
  homeDepotStoreId: '',
  applicantFirstName: 'Testy',
  middleName: '',
  applicantLastName: 'McTestface',
  applicantEmail: 'testy@example.com',
  applicantPhone: '705-123-4567',
  homePhone: '',
  maritalStatus: '',
  applicantAddress: '',
  province: 'ON',
  applicantDob: '',
  city: '',
  addressProvince: '',
  postalCode: '',
  housingStatus: '',
  monthlyHousingCost: '',
  yearsAtAddress: '',
  idType: '',
  govIdNumber: '',
  idProvince: '',
  idExpiry: '',
  businessName: '',
  positionTitle: '',
  employerAddress: '',
  employerPhone: '',
  grossMonthlyIncome: '',
  timeAtJobYears: '',
  employmentStatus: '',
  coApplicantName: '',
  notes: '',
  consent: 'on',
};

describe('applicationSchema', () => {
  it('accepts a valid submission with blank optional dropdowns/inputs', () => {
    const r = applicationSchema.safeParse(baseForm);
    expect(r.success).toBe(true);
  });

  it('coerces blank optional numbers/enums to undefined (not 0 or "")', () => {
    const r = applicationSchema.parse(baseForm);
    expect(r.housingStatus).toBeUndefined();
    expect(r.employmentStatus).toBeUndefined();
    expect(r.yearsAtAddress).toBeUndefined();
  });

  it('accepts filled housing/employment dropdowns', () => {
    const r = applicationSchema.safeParse({ ...baseForm, housingStatus: 'OWN', employmentStatus: 'EMPLOYED' });
    expect(r.success).toBe(true);
  });

  it('rejects a missing required program', () => {
    const { programType, ...rest } = baseForm;
    expect(applicationSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts a financing deal number in any format', () => {
    expect(applicationSchema.safeParse({ ...baseForm, financeItNumber: 'ABC-123456' }).success).toBe(true);
    expect(applicationSchema.safeParse({ ...baseForm, financeItNumber: '7123456' }).success).toBe(true);
  });

  it('rejects an over-long financing deal number', () => {
    expect(applicationSchema.safeParse({ ...baseForm, financeItNumber: 'x'.repeat(61) }).success).toBe(false);
  });
});
