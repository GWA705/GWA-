import type {
  ApplicationStatus,
  DocumentType,
  Province,
  ProgramType,
  ProgramCategory,
} from '@prisma/client';

export const PROGRAM_TYPES: { value: ProgramType; label: string }[] = [
  { value: 'HD', label: 'HD' },
  { value: 'GWA', label: 'GWA' },
];

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
  DECLINED: 'Declined',
  FUNDING_SUBMITTED: 'Funding submitted',
  FUNDING_REVIEW: 'Funding review',
  FUNDED: 'Funded',
  WITHDRAWN: 'Withdrawn',
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  CONDITIONAL: 'bg-purple-100 text-purple-800',
  APPROVED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  FUNDING_SUBMITTED: 'bg-indigo-100 text-indigo-800',
  FUNDING_REVIEW: 'bg-amber-100 text-amber-800',
  FUNDED: 'bg-emerald-100 text-emerald-800',
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

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SUPPORTING: 'Document for approval',
  SIGNED_CONTRACT: 'Signed finance docs (full package)',
  VOID_CHEQUE_OR_PAP: 'Void cheque / PAP form',
  INSTALL_PHOTO: 'Installed product photo',
  SIGNED_HD_DOCUMENT: 'Signed Home Depot document',
  HD_WAIVER: 'Home Depot waiver',
  PROOF_OF_HOMEOWNERSHIP: 'Proof of homeownership',
  GOVERNMENT_ID: 'Government ID',
  HD_PAPERWORK: 'HD paperwork',
  FINANCING_PAPERWORK: 'Financing paperwork',
  OTHER: 'Other supporting document',
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

export const CONSENT_POLICY_VERSION = '2026-01-mvp';

// PLACEHOLDER — must be replaced with wording reviewed by a Canadian privacy
// lawyer (PIPEDA + provincial law, incl. Quebec Law 25) before production use.
export const CONSENT_TEXT = `I confirm that the applicant has authorized GWA and the submitting dealer to \
collect, use, and disclose the personal information provided in this application \
(including financial and identity information) for the purpose of assessing and \
administering this credit application, and to obtain a consumer credit report \
where applicable. The applicant may withdraw consent and request access to their \
personal information subject to legal and contractual restrictions. \
[PLACEHOLDER CONSENT LANGUAGE — REQUIRES LEGAL REVIEW BEFORE PRODUCTION USE.]`;
