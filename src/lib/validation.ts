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

export const applicationSchema = z.object({
  province: z.enum(PROVINCE_VALUES),
  programType: z.enum(['HD', 'GWA']),
  programCategory: z.enum(['WATER', 'AIR', 'SMELL_BUSTERS', 'HVAC']),
  requestedAmount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(1_000_000),

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
