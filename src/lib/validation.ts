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
  // Financing deal number — any short reference from the finance company.
  financeItNumber: z.string().trim().max(60).optional(),

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

// The reviewer records deal reference numbers after approval. Finance companies
// and HD use varied formats, so these are lenient (any short reference).
export const dealReferencesSchema = z.object({
  applicationId: z.string().min(1),
  financeItNumber: z.string().trim().max(60).optional(),
  hdReference: z.string().trim().max(60).optional(),
});

export const announcementSchema = z
  .object({
    title: z.string().max(160).optional(),
    body: z.string().max(4000).optional(),
    linkUrl: z
      .string()
      .max(500)
      .optional()
      .refine((v) => !v || /^https?:\/\//i.test(v), 'Link must start with http(s)://'),
    hasImage: z.boolean().optional(),
  })
  .refine((d) => !!(d.title || d.body || d.hasImage), {
    message: 'Add some text or an image.',
    path: ['body'],
  });

export const contentSchema = z.object({
  section: z.enum(['RESOURCE', 'HD_PROMOTION', 'HD_CREDIT_CARD']),
  title: z.string().min(1, 'Enter a title').max(200),
  body: z.string().max(8000).optional(),
  linkUrl: z
    .string()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Link must start with http(s)://'),
  sortOrder: z.preprocess(
    (v) => (v === '' || v == null ? undefined : v),
    z.coerce.number().int().min(-1000).max(1000).optional(),
  ),
});

const boolFromForm = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const confirmationSchema = z.object({
  applicationId: z.string().min(1),
  intent: z.enum(['save', 'complete', 'issue']),
  productName: str(120),
  numberOfCalls: optionalInt,
  city: str(80),
  district: str(80),
  phoneNumber: str(30),
  installedWorking: boolFromForm.optional(),
  performingAsRepresented: boolFromForm.optional(),
  receivedEverything: boolFromForm.optional(),
  financingAmount: optionalNumber,
  termMonths: optionalInt,
  firstInstallmentAmount: optionalNumber,
  firstInstallmentDate: optionalDate,
  termsAgreed: boolFromForm.optional(),
  signatureConfirmed: boolFromForm.optional(),
  notTrialOffer: boolFromForm.optional(),
  specialArrangements: str(2000),
  hdNotes: str(4000),
  issueNote: str(2000),
});

export const noteSchema = z.object({
  applicationId: z.string().min(1),
  body: z.string().min(1, 'Write a note').max(4000),
  internal: z.coerce.boolean().optional().default(false),
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
  email: z.string().email('Enter a valid email address.').max(160),
  name: z.string().min(1, 'Enter the full name.').max(120),
  role: z.enum(['DEALER_USER', 'REVIEWER', 'ADMIN']),
  dealerId: z.string().optional(),
  // Length/complexity is enforced with a friendly message by
  // validatePasswordStrength() in the action, so keep the schema permissive.
  password: z.string().min(1, 'Enter a temporary password.').max(200),
});

export const createDealerSchema = z.object({
  name: z.string().min(1).max(160),
});

export const profileSchema = z.object({
  name: z.string().min(1, 'Enter your name').max(120),
  phone: z.string().max(30).optional(),
  notificationEmail: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Enter a valid email'),
  notifyStatusUpdates: z.coerce.boolean().optional().default(false),
  notifyNewNotes: z.coerce.boolean().optional().default(false),
  notifyNewDocuments: z.coerce.boolean().optional().default(false),
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
