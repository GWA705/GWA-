import type {
  ApplicationStatus,
  ConfirmationStatus,
  ContentSection,
  DocumentType,
  Province,
  ProgramType,
  ProgramCategory,
  PaymentMethod,
} from '@prisma/client';

export const CONFIRMATION_STATUS_LABELS: Record<ConfirmationStatus, string> = {
  PENDING: 'Pending confirmation',
  COMPLETED: 'Confirmation completed',
  ISSUE: 'Issue with confirmation',
};

export const CONFIRMATION_STATUS_COLORS: Record<ConfirmationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ISSUE: 'bg-red-100 text-red-700',
};

export const CONFIRMATION_PHONE = '1-866-874-2532';

export const PROGRAM_TYPES: { value: ProgramType; label: string }[] = [
  { value: 'HD', label: 'HD' },
  { value: 'GWA', label: 'GWA' },
];

// Payment types for an Express (payment-arranged) deal. FinanceIT is financed
// (needs an approval number); the rest are already-paid deals.
export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'FINANCEIT', label: 'FinanceIT' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'E_TRANSFER', label: 'E-Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
  { value: 'HD_CREDIT_CARD', label: 'Home Depot Credit Card' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  FINANCEIT: 'FinanceIT',
  FINANCE_COMPANY: 'Finance company',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  E_TRANSFER: 'E-Transfer',
  CREDIT_CARD: 'Credit card',
  HD_CREDIT_CARD: 'Home Depot Credit Card',
};

// Methods available for a split-payment line (each line = method + amount).
export const SPLIT_PAYMENT_METHODS: { value: PaymentMethod; label: string; financed: boolean }[] = [
  { value: 'FINANCEIT', label: 'FinanceIT', financed: true },
  { value: 'FINANCE_COMPANY', label: 'Finance company', financed: true },
  { value: 'CASH', label: 'Cash', financed: false },
  { value: 'CHEQUE', label: 'Cheque', financed: false },
  { value: 'E_TRANSFER', label: 'E-Transfer', financed: false },
  { value: 'CREDIT_CARD', label: 'Personal credit card', financed: false },
  { value: 'HD_CREDIT_CARD', label: 'Home Depot Credit Card', financed: false },
];

// Methods that count as financing — their amounts make up the financed portion.
export const FINANCED_PAYMENT_METHODS: PaymentMethod[] = ['FINANCEIT', 'FINANCE_COMPANY'];
export function isFinancedMethod(m: PaymentMethod): boolean {
  return FINANCED_PAYMENT_METHODS.includes(m);
}

// Payment methods that settle the deal outside of financing. These deals have no
// loan/approval number, so the Financing deal number is never required for them.
export const NON_FINANCE_PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CHEQUE', 'CREDIT_CARD', 'HD_CREDIT_CARD'];

// Whether a deal is financed (and therefore needs a Financing deal number). A
// null paymentMethod is a regular finance-company application (TYPED/PHOTO entry),
// which is financed; only the explicit already-paid methods are not.
export function dealIsFinanced(paymentMethod: PaymentMethod | null | undefined): boolean {
  return !paymentMethod || !NON_FINANCE_PAYMENT_METHODS.includes(paymentMethod);
}

// Whether the HD Customer # applies to a deal. Only HD-program deals carry one.
export function hdReferenceRequired(programType: ProgramType): boolean {
  return programType === 'HD';
}

// The reference numbers a deal must carry before it can move into funding or be
// written to the sales journal. The HD Customer # is required only on HD-program
// deals (GWA deals don't have one); the Financing deal number is required only
// for financed deals (not cash/cheque/credit/HD credit card).
export function missingRequiredReferences(app: {
  hdReference: string | null;
  financeItNumber: string | null;
  financed: boolean; // does the deal have a financed portion (see lib/payments)
  programType: ProgramType;
}): string[] {
  const missing: string[] = [];
  if (app.programType === 'HD' && !app.hdReference) missing.push('the HD Customer #');
  if (app.financed && !app.financeItNumber) missing.push('the Financing deal number');
  return missing;
}

// Builds the gate error message, or null when all required references are present.
export function referenceGateError(
  app: {
    hdReference: string | null;
    financeItNumber: string | null;
    financed: boolean;
    programType: ProgramType;
  },
  verb: string,
): string | null {
  const missing = missingRequiredReferences(app);
  if (missing.length === 0) return null;
  const list = missing.length === 2 ? `${missing[0]} and ${missing[1]}` : missing[0];
  return `Add ${list} before ${verb}.`;
}

export const PROGRAM_CATEGORIES: { value: ProgramCategory; label: string }[] = [
  { value: 'WATER', label: 'Water' },
  { value: 'AIR', label: 'Air' },
  { value: 'SMELL_BUSTERS', label: 'Smell Busters' },
  { value: 'HVAC', label: 'HVAC' },
];

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  HD: 'HD',
  GWA: 'GWA',
};

export const PROGRAM_CATEGORY_LABELS: Record<ProgramCategory, string> = {
  WATER: 'Water',
  AIR: 'Air',
  SMELL_BUSTERS: 'Smell Busters',
  HVAC: 'HVAC',
};

export function programLabel(type: ProgramType, category: ProgramCategory): string {
  return `${PROGRAM_TYPE_LABELS[type]} · ${PROGRAM_CATEGORY_LABELS[category]}`;
}

export const PROVINCES: { value: Province; label: string }[] = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CONDITIONAL: 'Conditionally approved',
  APPROVED: 'Approved',
  DOCS_SENT: 'Documents sent — awaiting install',
  DECLINED: 'Declined',
  FUNDING_SUBMITTED: 'Reviewing signed docs',
  FUNDING_REVIEW: 'In for funding',
  FUNDED: 'Funded',
  PROBLEM: 'Problem',
  WITHDRAWN: 'Withdrawn',
};

// Statuses a reviewer can set manually. The deal's status now advances on its
// own as the reviewer works the flow, so this is a fallback for jumping back or
// flagging a Problem. "Reviewing signed docs" (FUNDING_SUBMITTED) is omitted —
// it's set automatically when the dealer returns the signed package, and it read
// as a duplicate of "In for funding" in the menu.
export const MANUAL_STATUS_OPTIONS: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'CONDITIONAL',
  'DECLINED',
  'FUNDING_REVIEW',
  'FUNDED',
  'PROBLEM',
  'WITHDRAWN',
];

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  CONDITIONAL: 'bg-purple-100 text-purple-800',
  APPROVED: 'bg-green-100 text-green-800',
  DOCS_SENT: 'bg-sky-100 text-sky-800',
  DECLINED: 'bg-red-100 text-red-800',
  FUNDING_SUBMITTED: 'bg-indigo-100 text-indigo-800',
  FUNDING_REVIEW: 'bg-amber-100 text-amber-800',
  FUNDED: 'bg-emerald-100 text-emerald-800',
  PROBLEM: 'bg-orange-100 text-orange-800',
  WITHDRAWN: 'bg-gray-100 text-gray-700',
};

// The funding package checklist. Each entry maps to a DocumentType the dealer
// uploads at the funding stage.
export const FUNDING_DOCUMENT_TYPES: {
  type: DocumentType;
  label: string;
  required: boolean;
}[] = [
  { type: 'SIGNED_CONTRACT', label: 'Signed finance docs (full package)', required: true },
  { type: 'VOID_CHEQUE_OR_PAP', label: 'Void cheque or PAP form', required: true },
  { type: 'INSTALL_PHOTO', label: 'Pictures of installed products', required: true },
  { type: 'SIGNED_HD_DOCUMENT', label: 'Signed Home Depot documents', required: true },
  { type: 'HD_WAIVER', label: 'Signed & completed Home Depot waiver', required: true },
  { type: 'OTHER', label: 'Other supporting documents', required: false },
];

// Rule 2 — the reviewer's funding verification checklist. A fixed list of checks
// a reviewer works through before a deal can be funded. Every applicable item
// must be CONFIRMED; flagging one as a PROBLEM requires a note that is shown to
// the dealer and notifies them. `serialsOnly` items apply only to deals whose
// finance company requires a serial number per product (e.g. UEI).
export const VERIFICATION_CHECKS: {
  key: string;
  label: string;
  help?: string;
  serialsOnly?: boolean;
  taxOnly?: boolean;
}[] = [
  {
    key: 'TAX_EXEMPTION',
    label: 'Tax exemption verified & registered with HD',
    help: 'Status card seen and valid; exemption (full or provincial-only) registered with Home Depot before final payment.',
    taxOnly: true,
  },
  {
    key: 'PRODUCTS_PHOTO',
    label: 'Photo shows all installed products and serial numbers where required',
    help: 'Count the products in the picture and confirm it matches what the customer bought. Where a serial number is required, confirm it is visible and matches what was entered.',
  },
  {
    key: 'SIGNATURES',
    label: 'All required signatures are present',
    help: 'The contract and Home Depot documents are signed everywhere required.',
  },
  {
    key: 'PAP_VOID',
    label: 'Valid PAP form or void cheque on file',
    help: 'Pre-authorized payment banking details are included and legible.',
  },
];

// The verification checklist items that apply to a deal. The serial-match item
// only applies when the finance company requires a serial per product (e.g.
// UEI); the tax-exemption item only applies to a flagged tax-exempt deal.
// Shared by the FUND hard-gate and the checklist UI.
export function applicableVerificationChecks(requiresSerials: boolean, taxExempt = false) {
  return VERIFICATION_CHECKS.filter((c) => {
    if (c.serialsOnly && !requiresSerials) return false;
    if (c.taxOnly && !taxExempt) return false;
    return true;
  });
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SUPPORTING: 'Document for approval',
  SIGNED_CONTRACT: 'Signed finance docs (full package)',
  VOID_CHEQUE_OR_PAP: 'Void cheque / PAP form',
  INSTALL_PHOTO: 'Installed product photo',
  SIGNED_HD_DOCUMENT: 'Signed Home Depot document',
  HD_WAIVER: 'Home Depot waiver',
  PROOF_OF_HOMEOWNERSHIP: 'Proof of homeownership',
  GOVERNMENT_ID: 'Government ID',
  HD_PAPERWORK: 'HD Agreements',
  FINANCING_PAPERWORK: 'Financing paperwork',
  RELEASE_OF_FUNDS: 'Release of funds / completion certificate',
  OTHER: 'Other supporting document',
};

// Categories the reviewer uploads for the dealer (in the "Paperwork for dealer"
// section). Dealers can view and download these.
export const REVIEWER_PAPERWORK_TYPES: { type: DocumentType; label: string }[] = [
  { type: 'HD_PAPERWORK', label: 'HD Agreements' },
  { type: 'HD_WAIVER', label: 'HD Waiver' },
  { type: 'RELEASE_OF_FUNDS', label: 'Release of funds / completion certificate' },
  { type: 'FINANCING_PAPERWORK', label: 'Financing paperwork' },
  { type: 'OTHER', label: 'Other (type a name)' },
];

// Short filename prefix added to reviewer→dealer paperwork so dealers can tell
// the categories apart at a glance, e.g. "HD 1 Smith_Sean_2026-07-30_….pdf".
export const REVIEWER_PAPERWORK_PREFIX: Partial<Record<DocumentType, string>> = {
  HD_PAPERWORK: 'HD 1',
  HD_WAIVER: 'HD Waiver',
  FINANCING_PAPERWORK: 'Finance contract',
  RELEASE_OF_FUNDS: 'COC',
};

// Upload constraints.
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/webp',
];

// Files a dealer can download from a marketplace item (e.g. print-ready signage,
// artwork, guides). Broader than application uploads: also allows zipped bundles.
export const MARKETPLACE_FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
];

// Dealer-facing content sections (top-nav tabs). Each has a route slug, label,
// and a short blurb shown at the top of the page / empty state.
export const CONTENT_SECTIONS: {
  section: ContentSection;
  slug: string;
  label: string;
  blurb: string;
  emptyText: string;
}[] = [
  {
    section: 'RESOURCE',
    slug: 'resources',
    label: 'Resources',
    blurb: 'Guides, forms, and documents shared by GWA.',
    emptyText: 'No resources have been posted yet. Check back soon.',
  },
  {
    section: 'HD_PROMOTION',
    slug: 'hd-promotions',
    label: 'HD Promotions',
    blurb: 'Current Home Depot promotions and program details.',
    emptyText: 'No promotions are running right now. Check back soon.',
  },
  {
    section: 'HD_CREDIT_CARD',
    slug: 'hd-credit-card',
    label: 'HD Credit Card',
    blurb: 'How to process a Home Depot credit card — step-by-step help for dealers.',
    emptyText: 'The HD Credit Card guide is being prepared and will appear here soon.',
  },
];

export const CONTENT_SECTION_LABELS: Record<ContentSection, string> = {
  RESOURCE: 'Resources',
  HD_PROMOTION: 'HD Promotions',
  HD_CREDIT_CARD: 'HD Credit Card',
};

export function contentSlugToSection(slug: string): ContentSection | null {
  return CONTENT_SECTIONS.find((s) => s.slug === slug)?.section ?? null;
}

// Accepted government photo ID types (Canadian). The dealer selects one on the
// application; the value is stored as-is and shown back on the deal.
export const PHOTO_ID_TYPES = [
  "Driver's Licence",
  'Current Canadian Passport',
  'Canadian Citizenship Card',
  'Permanent Resident Card',
  'Certificate of Indian Status issued by the Government of Canada',
  'Provincial Government Photo Identification Card',
  'Nexus Card',
  'LCBO BYID Card',
];

export const CONSENT_POLICY_VERSION = '2026-01-mvp';

// PLACEHOLDER — must be replaced with wording reviewed by a Canadian privacy
// lawyer (PIPEDA + provincial law, incl. Quebec Law 25) before production use.
export const CONSENT_TEXT = `I confirm that the applicant has authorized GWA and the submitting dealer to \
collect, use, and disclose the personal information provided in this application \
(including financial and identity information) for the purpose of assessing and \
administering this credit application, and to obtain a consumer credit report \
where applicable. The applicant may withdraw consent and request access to their \
personal information subject to legal and contractual restrictions.`;

// ---------------------------------------------------------------------------
// Back-end admin sections (granular access control)
// ---------------------------------------------------------------------------
// The single source of truth for every gate-able area of the admin/back-end.
// A Super Admin has all of these; a scoped admin has only the keys stored in
// User.adminSections. Order here is also the nav order and the order used to
// pick a scoped admin's landing page (first one they're allowed).
export interface AdminSection {
  key: string;
  label: string;
  href: string;
  // A one-line description shown on the Admin access management screen.
  hint?: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', label: 'Overview', href: '/admin', hint: 'Dashboard KPIs' },
  { key: 'dealers', label: 'Dealers', href: '/admin/dealers' },
  { key: 'finance', label: 'Finance companies', href: '/admin/finance-companies' },
  { key: 'products', label: 'Products', href: '/admin/products' },
  { key: 'announcements', label: 'Dealer portal sign', href: '/admin/announcements' },
  { key: 'alerts', label: 'Pop-up alerts', href: '/admin/alerts' },
  { key: 'reminders', label: 'Dealer reminders', href: '/admin/reminders' },
  { key: 'note-templates', label: 'Quick notes', href: '/admin/note-templates' },
  { key: 'content', label: 'Content', href: '/admin/content', hint: 'Resources / promos' },
  { key: 'marketplace', label: 'Marketplace', href: '/admin/marketplace' },
  { key: 'mail', label: 'Mail', href: '/staff/mail', hint: 'Send + reply toggle' },
  { key: 'users', label: 'Users', href: '/admin/users' },
  { key: 'security', label: 'Security', href: '/admin/security' },
  { key: 'email', label: 'Email settings', href: '/admin/email' },
  { key: 'audit', label: 'Audit log', href: '/admin/audit' },
  { key: 'review-queue', label: 'Review queue', href: '/staff', hint: 'Deals queue' },
];

export const ADMIN_SECTION_KEYS: string[] = ADMIN_SECTIONS.map((s) => s.key);

export function isAdminSectionKey(key: string): boolean {
  return ADMIN_SECTION_KEYS.includes(key);
}

// ---------------------------------------------------------------------------
// Marketplace merchandising tags (fixed set, coloured badges)
// ---------------------------------------------------------------------------
export interface MarketplaceTag {
  key: string;
  label: string;
  // Tailwind classes for the coloured badge shown on item cards.
  badgeClass: string;
}

export const MARKETPLACE_TAGS: MarketplaceTag[] = [
  { key: 'NEW', label: 'New', badgeClass: 'bg-green-600 text-white' },
  { key: 'SALE', label: 'Sale', badgeClass: 'bg-red-600 text-white' },
  { key: 'CLEARANCE', label: 'Clearance', badgeClass: 'bg-orange-600 text-white' },
  { key: 'POPULAR', label: 'Popular', badgeClass: 'bg-purple-600 text-white' },
];

export const MARKETPLACE_TAG_KEYS: string[] = MARKETPLACE_TAGS.map((t) => t.key);

export function marketplaceTag(key: string): MarketplaceTag | undefined {
  return MARKETPLACE_TAGS.find((t) => t.key === key);
}
