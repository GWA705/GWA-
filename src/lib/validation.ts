import { z } from 'zod';

const PROVINCE_VALUES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

// Canadian SIN: 9 digits (spaces/dashes tolerated on input).
const sinRegex = /^\d{3}[\s-]?\d{3}[\s-]?\d{3}$/;

export const applicationSchema = z.object({
  province: z.enum(PROVINCE_VALUES),
  program: z.string().min(1, 'Program is required').max(120),
  requestedAmount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(1_000_000),

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
