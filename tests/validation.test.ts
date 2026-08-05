import { describe, it, expect } from 'vitest';
import { applicationSchema, formatPersonName } from '@/lib/validation';

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
  // Borrower identification is mandatory on a TYPED application.
  idType: "Driver's licence",
  govIdNumber: 'D1234-56789',
  idProvince: 'ON',
  idExpiry: '2030-01-01',
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

describe('formatPersonName', () => {
  it('capitalizes the first letter of each name part', () => {
    expect(formatPersonName('jesmond gauci')).toBe('Jesmond Gauci');
    expect(formatPersonName('sean jaiko')).toBe('Sean Jaiko');
    expect(formatPersonName('kim j')).toBe('Kim J');
  });

  it('normalizes ALL CAPS and mixed case', () => {
    expect(formatPersonName('SEAN JAIKO')).toBe('Sean Jaiko');
    expect(formatPersonName('mARY sMITH')).toBe('Mary Smith');
  });

  it('collapses and trims extra whitespace', () => {
    expect(formatPersonName('  mary   smith  ')).toBe('Mary Smith');
  });

  it('handles hyphens, apostrophes, and Mc/Mac prefixes', () => {
    expect(formatPersonName('anne-marie')).toBe('Anne-Marie');
    expect(formatPersonName("o'brien")).toBe("O'Brien");
    expect(formatPersonName('mcdonald')).toBe('McDonald');
  });

  it('leaves an empty string empty', () => {
    expect(formatPersonName('')).toBe('');
    expect(formatPersonName('   ')).toBe('');
  });
});

describe('applicationSchema name normalization', () => {
  it('formats applicant first/last name however it is typed', () => {
    const r = applicationSchema.parse({ ...baseForm, applicantFirstName: 'jesmond', applicantLastName: 'gauci' });
    expect(r.applicantFirstName).toBe('Jesmond');
    expect(r.applicantLastName).toBe('Gauci');
  });

  it('normalizes a co-applicant name', () => {
    const r = applicationSchema.parse({ ...baseForm, coApplicantName: 'kim j' });
    expect(r.coApplicantName).toBe('Kim J');
  });
});

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

  it('requires borrower identification on a TYPED application', () => {
    const r = applicationSchema.safeParse({ ...baseForm, idType: '', govIdNumber: '', idProvince: '', idExpiry: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(expect.arrayContaining(['idType', 'govIdNumber', 'idProvince', 'idExpiry']));
    }
  });

  it('does not require borrower identification on non-TYPED methods', () => {
    const r = applicationSchema.safeParse({
      ...baseForm,
      entryMethod: 'PHOTO',
      idType: '',
      govIdNumber: '',
      idProvince: '',
      idExpiry: '',
    });
    expect(r.success).toBe(true);
  });
});

describe('minimum applicant age', () => {
  it('rejects an under-18 applicant', () => {
    const r = applicationSchema.safeParse({ ...baseForm, applicantDob: '2020-01-01' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === 'applicantDob')).toBe(true);
    }
  });

  it('accepts an adult applicant', () => {
    expect(applicationSchema.safeParse({ ...baseForm, applicantDob: '1990-01-01' }).success).toBe(true);
  });

  it('rejects an under-18 co-applicant', () => {
    const r = applicationSchema.safeParse({ ...baseForm, coDob: '2020-01-01' });
    expect(r.success).toBe(false);
  });

  it('still accepts a blank birthdate (optional on some paths)', () => {
    expect(applicationSchema.safeParse({ ...baseForm, applicantDob: '' }).success).toBe(true);
  });
});
