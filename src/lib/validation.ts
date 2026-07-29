import { z } from 'zod';

const PROVINCE_VALUES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

// Canadian SIN: 9 digits (spaces/dashes tolerated on input).
const sinRegex = /^\d{3}[\s-]?\d{3}[\s-]?\d{3}$/;

const optionalDate = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date');

// Treat empty strings as "not provided" before coercing to a number.
const optionalNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().nonnegative().max(100_000_000).optional(),
);
const optionalInt = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().int().nonnegative().max(120).optional(),
);
const str = (max: number) => z.string().max(max).optional();
// Optional dropdown: an unselected <select> posts "" — treat that as "not provided".
const blankToUndef = (v: unknown) => (v === '' || v == null ? undefined : v);

export const applicationSchema = z.object({
  entryMethod: z.enum(['TYPED', 'PHOTO', 'FINANCEIT']).optional().default('TYPED'),
  province: z.enum(PROVINCE_VALUES),
  programType: z.enum(['HD', 'GWA']),
  programCategory: z.enum(['WATER', 'AIR', 'SMELL_BUSTERS', 'HVAC']),
  requestedAmount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(1_000_000),

  // Extended loan-application fields (typed entry) — all optional.
  middleName: str(80),
  homePhone: str(30),
  maritalStatus: str(30),
  housingStatus: z.preprocess(blankToUndef, z.enum(['OWN', 'RENT', 'OTHER']).optional()),
  monthlyHousingCost: optionalNumber,
  yearsAtAddress: optionalInt,
  city: str(80),
  addressProvince: str(40),
  postalCode: str(10),
  mailingAddress: str(200),
  mailingCity: str(80),
  mailingProvince: str(40),
  mailingPostal: str(10),
  previousAddress: str(200),
  previousCity: str(80),
  previousProvince: str(40),
  previousPostal: str(10),
  worksiteAddress: str(200),
  worksiteCity: str(80),
  worksiteProvince: str(40),
  worksitePostal: str(10),
  idType: str(60),
  idProvince: str(40),
  idExpiry: optionalDate,
  businessName: str(160),
  positionTitle: str(120),
  employerAddress: str(200),
  employerPhone: str(30),
  grossMonthlyIncome: optionalNumber,
  timeAtJobYears: optionalInt,
  employmentStatus: z.preprocess(blankToUndef, z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'OTHER']).optional()),

  // Deal details
  dateOfSale: optionalDate,
  installationDate: optionalDate,
  homeDepotStoreId: z.string().optional(),
  financingNote: z.string().max(2000).optional(),

  // Reference numbers
  loanReference: z.string().max(60).optional(),
  financeReference: z.string().max(60).optional(),
  hdReference: z.string().max(60).optional(),
  financeItNumber: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^7\d{6}$/.test(v.replace(/\s/g, '')),
      'FinanceIt number should be 7 digits starting with 7',
    ),

  applicantFirstName: z.string().min(1).max(80),
  applicantLastName: z.string().min(1).max(80),
  applicantEmail: z.string().email().max(160),
  applicantPhone: z.string().min(7).max(30),

  applicantSin: z
    .string()
    .optional()
    .refine((v) => !v || sinRegex.test(v), 'SIN must be 9 digits'),
  applicantDob: z.string().optional(),
  applicantAddress: z.string().max(300).optional(),
  bankAccount: z.string().max(120).optional(),
  govIdNumber: z.string().max(80).optional(),

  coApplicantName: z.string().max(160).optional(),
  coApplicantSin: z
    .string()
    .optional()
    .refine((v) => !v || sinRegex.test(v), 'Co-applicant SIN must be 9 digits'),

  incomeAnnual: z.coerce.number().nonnegative().max(100_000_000).optional(),
  employer: z.string().max(160).optional(),
  notes: z.string().max(4000).optional(),

  homeownershipRequired: z.coerce.boolean().optional().default(false),

  consent: z
    .union([z.literal('on'), z.literal('true'), z.literal(true)])
    .refine((v) => v === 'on' || v === 'true' || v === true, 'Consent is required'),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const decisionSchema = z.object({
  applicationId: z.string().min(1),
  type: z.enum(['APPROVE', 'DECLINE', 'CONDITIONAL', 'REQUEST_DOCS', 'FUND']),
  notes: z.string().max(4000).optional(),
  // Captured when approving.
  approvedAmount: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().positive().max(1_000_000).optional(),
  ),
  financeCompanyId: z.string().optional(),
});

export const createFinanceCompanySchema = z.object({
  name: z.string().min(1).max(160),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const mfaSchema = z.object({
  token: z.string().min(6).max(10),
});

export const serialNumberSchema = z.object({
  value: z.string().min(1).max(120),
  productLabel: z.string().max(120).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email().max(160),
  name: z.string().min(1).max(120),
  role: z.enum(['DEALER_USER', 'REVIEWER', 'ADMIN']),
  dealerId: z.string().optional(),
  password: z.string().min(12).max(200),
});

export const createDealerSchema = z.object({
  name: z.string().min(1).max(160),
});

export const statusChangeSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'CONDITIONAL',
    'DECLINED',
    'FUNDING_SUBMITTED',
    'FUNDING_REVIEW',
    'FUNDED',
    'PROBLEM',
    'WITHDRAWN',
  ]),
  note: z.string().max(1000).optional(),
});

export const payoutSchema = z.object({
  applicationId: z.string().min(1),
  amount: z.coerce.number().positive('Amount must be greater than 0').max(10_000_000),
  paidOn: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  method: z.string().max(40).optional(),
  reference: z.string().max(80).optional(),
  note: z.string().max(1000).optional(),
});
