import { z } from 'zod';

const PROVINCE_VALUES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

// Canadian SIN: 9 digits (spaces/dashes tolerated on input).
const sinRegex = /^\d{3}[\s-]?\d{3}[\s-]?\d{3}$/;

// Minimum applicant age for a credit application.
export const MIN_APPLICANT_AGE = 18;

/** Whole years between a 'YYYY-MM-DD' birthdate and today, or null if unparseable. */
export function ageInYears(dob: string, today: Date = new Date()): number | null {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

/** True when the birthdate is a valid date and the person is at least 18. */
export function isAdult(dob: string): boolean {
  const age = ageInYears(dob);
  return age !== null && age >= MIN_APPLICANT_AGE;
}

/** The latest DOB (YYYY-MM-DD) that still satisfies the minimum age — for input `max`. */
export function maxAdultDob(today: Date = new Date()): string {
  const d = new Date(today.getFullYear() - MIN_APPLICANT_AGE, today.getMonth(), today.getDate());
  return d.toISOString().slice(0, 10);
}

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

/**
 * Normalize a person's name to proper capitalization regardless of how it was
 * typed: "jesmond gauci" -> "Jesmond Gauci", "SEAN JAIKO" -> "Sean Jaiko",
 * "kim j" -> "Kim J". Collapses whitespace and capitalizes after spaces,
 * hyphens, and apostrophes (so "anne-marie" -> "Anne-Marie", "o'brien" ->
 * "O'Brien"), with a Mc-prefix rule ("mcdonald" -> "McDonald").
 */
export function formatPersonName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) return cleaned;
  return cleaned
    .toLowerCase()
    .replace(/(^|[\s\-'’])([a-zà-ÿ])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bMc([a-zà-ÿ])/g, (_, ch: string) => 'Mc' + ch.toUpperCase());
}

// Optional person-name field: validated to a max length, then normalized to
// proper case only when a value is present.
const optName = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? formatPersonName(v) : v));

export const applicationSchema = z.object({
  entryMethod: z.enum(['TYPED', 'PHOTO', 'FINANCEIT']).optional().default('TYPED'),
  paymentMethod: z.preprocess(
    blankToUndef,
    z.enum(['FINANCEIT', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'HD_CREDIT_CARD']).optional(),
  ),
  province: z.enum(PROVINCE_VALUES),
  programType: z.enum(['HD', 'GWA']),
  programCategory: z.enum(['WATER', 'AIR', 'SMELL_BUSTERS', 'HVAC']),
  requestedAmount: z.coerce
    .number()
    .positive('Amount must be greater than 0')
    .max(1_000_000),

  // Extended loan-application fields (typed entry) — all optional.
  middleName: optName(80),
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
  employmentStatus: z.preprocess(blankToUndef, z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'OTHER']).optional()),

  // Deal details
  dateOfSale: optionalDate,
  installationDate: optionalDate,
  homeDepotStoreId: z.string().optional(),
  financingNote: z.string().max(2000).optional(),

  // Sales-journal detail fields (dealer-entered). productsSold is multi-value
  // and read via formData.getAll(), so it is not part of this object schema.
  salespersonName: optName(120),
  installerName: optName(120),
  soapIncluded: z.preprocess(blankToUndef, z.enum(['YES', 'NO']).optional()),

  // Reference numbers
  loanReference: z.string().max(60).optional(),
  financeReference: z.string().max(60).optional(),
  hdReference: z.string().max(60).optional(),
  // Financing deal number — any short reference from the finance company.
  financeItNumber: z.string().trim().max(60).optional(),

  applicantFirstName: z.string().min(1).max(80).transform(formatPersonName),
  applicantLastName: z.string().min(1).max(80).transform(formatPersonName),
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

  coApplicantName: optName(160),
  coApplicantSin: z
    .string()
    .optional()
    .refine((v) => !v || sinRegex.test(v), 'Co-applicant SIN must be 9 digits'),

  // Co-applicant details (typed entry) — revealed when a name is entered; the
  // same set of questions as the main applicant. All optional at the schema
  // level; SIN/banking are not collected (same as the main applicant).
  coFirstName: optName(80),
  coLastName: optName(80),
  coMiddleName: optName(80),
  coDob: z.string().optional(),
  coEmail: z.preprocess(blankToUndef, z.string().email().max(160).optional()),
  coPhone: str(30),
  coHomePhone: str(30),
  coMaritalStatus: str(30),
  coRelationship: str(60),
  coAddress: str(300),
  coCity: str(80),
  coProvince: str(40),
  coPostal: str(10),
  coIdType: str(60),
  coGovIdNumber: str(80),
  coIdProvince: str(40),
  coIdExpiry: optionalDate,
  coBusinessName: str(160),
  coPositionTitle: str(120),
  coEmployerAddress: str(200),
  coEmployerPhone: str(30),
  coGrossMonthlyIncome: optionalNumber,
  coTimeAtJobYears: optionalInt,
  coEmploymentStatus: z.preprocess(blankToUndef, z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'OTHER']).optional()),

  incomeAnnual: z.coerce.number().nonnegative().max(100_000_000).optional(),
  employer: z.string().max(160).optional(),
  notes: z.string().max(4000).optional(),

  homeownershipRequired: z.coerce.boolean().optional().default(false),

  consent: z
    .union([z.literal('on'), z.literal('true'), z.literal(true)])
    .refine((v) => v === 'on' || v === 'true' || v === true, 'Consent is required'),
}).superRefine((d, ctx) => {
  // On the typed application, borrower identification is mandatory: photo ID
  // type, ID number, province of issue, and expiry date.
  if (d.entryMethod === 'TYPED') {
    const required: [keyof typeof d, string][] = [
      ['idType', 'Photo ID type is required'],
      ['govIdNumber', 'Photo ID number is required'],
      ['idProvince', 'Province of issue is required'],
      ['idExpiry', 'ID expiry date is required'],
    ];
    for (const [key, message] of required) {
      const v = d[key];
      if (!v || !String(v).trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key as string], message });
      }
    }
  }
  // Applicants (and co-applicants) must be adults. Only checked when a birthdate
  // is entered, since DOB is optional on some entry paths.
  if (d.applicantDob && d.applicantDob.trim() && !isAdult(d.applicantDob)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['applicantDob'], message: 'Applicant must be at least 18 years old' });
  }
  if (d.coDob && d.coDob.trim() && !isAdult(d.coDob)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['coDob'], message: 'Co-applicant must be at least 18 years old' });
  }
  // Express (payment-arranged) deal: a payment type is required, and a FinanceIT
  // deal must carry its approval number.
  if (d.entryMethod === 'FINANCEIT') {
    if (!d.paymentMethod) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentMethod'], message: 'Select how the customer paid' });
    }
    if (d.paymentMethod === 'FINANCEIT' && (!d.financeItNumber || !d.financeItNumber.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['financeItNumber'], message: 'FinanceIT approval number is required' });
    }
  }
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

// Reviewer/admin edit of an existing deal — full applicant + deal details
// (everything except the encrypted consent record). Core fields that are
// non-null on the Application are required; the rest are optional.
export const editDealSchema = z.object({
  province: z.enum(PROVINCE_VALUES),
  programType: z.enum(['HD', 'GWA']),
  programCategory: z.enum(['WATER', 'AIR', 'SMELL_BUSTERS', 'HVAC']),
  requestedAmount: z.coerce.number().positive('Amount must be greater than 0').max(1_000_000),
  approvedAmount: optionalNumber,

  applicantFirstName: z.string().min(1, 'First name is required').max(80).transform(formatPersonName),
  applicantLastName: z.string().min(1, 'Last name is required').max(80).transform(formatPersonName),
  applicantEmail: z.string().email('Enter a valid email').max(160),
  applicantPhone: z.string().min(7, 'Enter a valid phone').max(30),
  applicantDob: z.string().optional(),
  applicantAddress: z.string().max(300).optional(),
  govIdNumber: z.string().max(80).optional(),

  dateOfSale: optionalDate,
  installationDate: optionalDate,
  financingNote: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),

  // Sales-journal detail fields (editable by reviewers). productsSold is
  // multi-value and read via formData.getAll(), not through this object schema.
  salespersonName: optName(120),
  installerName: optName(120),
  soapIncluded: z.preprocess(blankToUndef, z.enum(['YES', 'NO']).optional()),

  // LoanApplication (extended) fields.
  middleName: optName(80),
  homePhone: str(30),
  maritalStatus: str(30),
  housingStatus: z.preprocess(blankToUndef, z.enum(['OWN', 'RENT', 'OTHER']).optional()),
  monthlyHousingCost: optionalNumber,
  yearsAtAddress: optionalInt,
  city: str(80),
  addressProvince: str(40),
  postalCode: str(10),
  idType: str(60),
  idProvince: str(40),
  idExpiry: optionalDate,
  businessName: str(160),
  positionTitle: str(120),
  employerAddress: str(200),
  employerPhone: str(30),
  grossMonthlyIncome: optionalNumber,
  timeAtJobYears: optionalInt,
  employmentStatus: z.preprocess(blankToUndef, z.enum(['EMPLOYED', 'SELF_EMPLOYED', 'RETIRED', 'OTHER']).optional()),
}).superRefine((d, ctx) => {
  if (d.applicantDob && d.applicantDob.trim() && !isAdult(d.applicantDob)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['applicantDob'], message: 'Applicant must be at least 18 years old' });
  }
});

export type EditDealInput = z.infer<typeof editDealSchema>;

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
    position: z.enum(['TOP', 'BOTTOM']).optional().default('TOP'),
    hasImage: z.boolean().optional(),
  })
  .refine((d) => !!(d.title || d.body || d.hasImage), {
    message: 'Add some text or an image.',
    path: ['body'],
  });

// Admin-managed must-read pop-up for dealers (forced acknowledgement).
export const dealerAlertSchema = z.object({
  title: z.string().min(1, 'Enter a title').max(160),
  body: z.string().min(1, 'Enter a message').max(4000),
  linkUrl: z
    .string()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), 'Link must start with http(s)://'),
  audience: z
    .enum(['ALL_DEALERS', 'DEALER', 'REVIEWERS', 'ADMINS', 'STAFF', 'EVERYONE'])
    .optional()
    .default('ALL_DEALERS'),
  dealerId: z.string().optional(), // used only when audience = DEALER
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

export const updateUserSchema = z.object({
  email: z.string().email('Enter a valid email address.').max(160),
  name: z.string().min(1, 'Enter the full name.').max(120),
  role: z.enum(['DEALER_USER', 'REVIEWER', 'ADMIN']),
  dealerId: z.string().optional(),
  // Optional: set a new temporary password (blank = leave the password as-is).
  newPassword: z.string().max(200).optional(),
});

export const createDealerSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum(['DISTRIBUTOR', 'DEALER']).optional().default('DEALER'),
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
  notifyAttentionAlerts: z.coerce.boolean().optional().default(false),
  notifyIdleReminders: z.coerce.boolean().optional().default(false),
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
