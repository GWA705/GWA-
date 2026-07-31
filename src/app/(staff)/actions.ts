'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { markReviewerAction } from '@/lib/activity';
import { encryptOptional, decryptOptional } from '@/lib/crypto';
import { writeDealToJournal, journalEnabled, type JournalDeal } from '@/lib/journal';
import { storeFiles } from '@/lib/upload';
import { notifyStatusChange, notifyNewNote } from '@/lib/notify';
import {
  decisionSchema,
  payoutSchema,
  statusChangeSchema,
  noteSchema,
  confirmationSchema,
  dealReferencesSchema,
  editDealSchema,
} from '@/lib/validation';
import { FUNDING_DOCUMENT_TYPES, REVIEWER_PAPERWORK_PREFIX, REVIEWER_PAPERWORK_TYPES } from '@/lib/constants';
import type { ApplicationStatus, DecisionType, DocumentType } from '@prisma/client';

export interface ActionState {
  error?: string;
  ok?: boolean;
}

// Map a decision to the resulting application status. `null` means "leave the
// status unchanged" (e.g. requesting more docs).
function nextStatus(type: DecisionType): ApplicationStatus | null {
  switch (type) {
    case 'APPROVE':
      return 'APPROVED';
    case 'DECLINE':
      return 'DECLINED';
    case 'CONDITIONAL':
      return 'CONDITIONAL';
    case 'REQUEST_DOCS':
      return 'UNDER_REVIEW';
    case 'FUND':
      return 'FUNDED';
    default:
      return null;
  }
}

/** Reviewer records/updates deal reference numbers after approval. */
export async function setDealReferencesAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const parsed = dealReferencesSchema.safeParse({
    applicationId,
    financeItNumber: (formData.get('financeItNumber') as string) ?? '',
    hdReference: (formData.get('hdReference') as string) ?? '',
  });
  if (!parsed.success) return { error: 'Reference numbers can be up to 60 characters.' };

  const financeItNumber = parsed.data.financeItNumber?.trim() || null;
  const hdReference = parsed.data.hdReference?.trim() || null;
  await prisma.application.update({
    where: { id: applicationId },
    data: { financeItNumber, hdReference },
  });
  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `References set — financing #${financeItNumber ?? '—'}, HD customer #${hdReference ?? '—'}`,
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return { ok: true };
}

// Which current statuses permit which decision.
function isTransitionAllowed(current: ApplicationStatus, type: DecisionType): boolean {
  const preDecision: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'CONDITIONAL'];
  switch (type) {
    case 'APPROVE':
    case 'DECLINE':
    case 'CONDITIONAL':
    case 'REQUEST_DOCS':
      return preDecision.includes(current);
    case 'FUND':
      return ['FUNDING_SUBMITTED', 'FUNDING_REVIEW'].includes(current);
    default:
      return false;
  }
}

export async function recordDecisionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');

  const parsed = decisionSchema.safeParse({
    applicationId: formData.get('applicationId'),
    type: formData.get('type'),
    notes: formData.get('notes') || undefined,
    approvedAmount: formData.get('approvedAmount') ?? undefined,
    financeCompanyId: formData.get('financeCompanyId') || undefined,
  });
  if (!parsed.success) return { error: 'Invalid decision.' };
  const { applicationId, type, notes, approvedAmount, financeCompanyId } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };

  if (!isTransitionAllowed(app.status, type)) {
    return { error: `Cannot ${type.replace('_', ' ').toLowerCase()} an application in status ${app.status}.` };
  }

  // Funding a deal requires both reference numbers on file.
  if (type === 'FUND' && (!app.hdReference || !app.financeItNumber)) {
    return { error: 'Add both the HD Customer # and the Financing deal number before funding this deal.' };
  }

  const to = nextStatus(type);

  // On an approval, record the approved amount, finance company, and approver.
  const isApproval = type === 'APPROVE' || type === 'CONDITIONAL';
  const approvalData = isApproval
    ? {
        approvedAmount: approvedAmount ?? app.approvedAmount ?? app.requestedAmount,
        financeCompanyId: financeCompanyId ?? app.financeCompanyId,
        approvedById: session.userId,
      }
    : {};

  await prisma.$transaction(async (tx) => {
    await tx.decision.create({
      data: { applicationId, type, notes: notes || null, decidedById: session.userId },
    });
    if (isApproval) {
      await tx.application.update({ where: { id: applicationId }, data: approvalData });
    }
    if (to && to !== app.status) {
      await tx.application.update({ where: { id: applicationId }, data: { status: to } });
      await tx.statusEvent.create({
        data: {
          applicationId,
          from: app.status,
          to,
          actorId: session.userId,
          note: notes || `Decision: ${type}`,
        },
      });
    }
  });

  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: type === 'FUND' ? 'FUNDING_DECISION' : 'DECISION',
    entityType: 'Application',
    entityId: applicationId,
    detail: `${type}${notes ? `: ${notes.slice(0, 200)}` : ''}`,
  });

  if (to && to !== app.status) await notifyStatusChange(applicationId, to);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/** Move a submitted application into review (reviewer picks it up). */
export async function startReviewAction(applicationId: string): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return;
  if (app.status === 'SUBMITTED') {
    await prisma.$transaction([
      prisma.application.update({ where: { id: applicationId }, data: { status: 'UNDER_REVIEW' } }),
      prisma.statusEvent.create({
        data: { applicationId, from: 'SUBMITTED', to: 'UNDER_REVIEW', actorId: session.userId, note: 'Review started' },
      }),
    ]);
    await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: applicationId, detail: 'UNDER_REVIEW' });
  }
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
}

/** Move a submitted funding package into review. */
export async function startFundingReviewAction(applicationId: string): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return;
  if (app.status === 'FUNDING_SUBMITTED') {
    await prisma.$transaction([
      prisma.application.update({ where: { id: applicationId }, data: { status: 'FUNDING_REVIEW' } }),
      prisma.statusEvent.create({
        data: { applicationId, from: 'FUNDING_SUBMITTED', to: 'FUNDING_REVIEW', actorId: session.userId, note: 'Funding review started' },
      }),
    ]);
    await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: applicationId, detail: 'FUNDING_REVIEW' });
  }
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
}

// Reviewer/admin uploads paperwork FOR the dealer. The category is chosen from
// a dropdown and arrives in the form data (one drop zone for all types).
export async function uploadReviewerPaperworkAction(
  applicationId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Not found.' };

  const category = String(formData.get('category') || '');
  const allowed = REVIEWER_PAPERWORK_TYPES.map((t) => t.type) as string[];
  if (!allowed.includes(category)) return { error: 'Choose a paperwork type first.' };
  const docType = category as DocumentType;

  const files = formData.getAll('file') as File[];
  const result = await storeFiles({
    application: {
      id: app.id,
      dealerId: app.dealerId,
      applicantFirstName: app.applicantFirstName,
      applicantLastName: app.applicantLastName,
      dateOfSale: app.dateOfSale,
    },
    files,
    type: docType,
    stage: 'REVIEWER',
    uploadedById: session.userId,
    namePrefix: REVIEWER_PAPERWORK_PREFIX[docType],
  });
  if (result.error) return result;

  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  return {};
}

// Reviewer/admin edits an existing deal — full applicant + deal details. Older
// deals created before certain fields existed (e.g. ID province/type) can be
// filled in here. Sensitive fields are re-encrypted; the change is audited.
export async function updateDealAction(
  applicationId: string,
  _prev: { error?: string; fieldErrors?: Record<string, string> },
  formData: FormData,
): Promise<{ error?: string; fieldErrors?: Record<string, string> }> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Deal not found.' };

  const parsed = editDealSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
    return { error: 'Please correct the highlighted fields.', fieldErrors };
  }
  const d = parsed.data;

  const loanData = {
    middleName: d.middleName || null,
    homePhone: d.homePhone || null,
    maritalStatus: d.maritalStatus || null,
    housingStatus: d.housingStatus ?? null,
    monthlyHousingCost: d.monthlyHousingCost ?? null,
    yearsAtAddress: d.yearsAtAddress ?? null,
    city: d.city || null,
    addressProvince: d.addressProvince || null,
    postalCode: d.postalCode || null,
    idType: d.idType || null,
    idProvince: d.idProvince || null,
    idExpiry: d.idExpiry ? new Date(d.idExpiry) : null,
    businessName: d.businessName || null,
    positionTitle: d.positionTitle || null,
    employerAddress: d.employerAddress || null,
    employerPhone: d.employerPhone || null,
    grossMonthlyIncome: d.grossMonthlyIncome ?? null,
    timeAtJobYears: d.timeAtJobYears ?? null,
    employmentStatus: d.employmentStatus ?? null,
  };

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      province: d.province,
      programType: d.programType,
      programCategory: d.programCategory,
      requestedAmount: d.requestedAmount,
      approvedAmount: d.approvedAmount ?? null,
      applicantFirstName: d.applicantFirstName,
      applicantLastName: d.applicantLastName,
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      applicantDobEnc: encryptOptional(d.applicantDob),
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      govIdNumberEnc: encryptOptional(d.govIdNumber),
      dateOfSale: d.dateOfSale ? new Date(d.dateOfSale) : null,
      installationDate: d.installationDate ? new Date(d.installationDate) : null,
      financingNote: d.financingNote || null,
      notes: d.notes || null,
      // Sales-journal detail fields (reviewer backfill).
      leadGenerator: d.leadGenerator || null,
      salespersonName: d.salespersonName || null,
      installerName: d.installerName || null,
      soapIncluded: d.soapIncluded === 'YES' ? true : d.soapIncluded === 'NO' ? false : null,
      productsSold: formData.getAll('productsSold').map(String).map((s) => s.trim()).filter(Boolean).slice(0, 50),
      incomeAnnual: d.grossMonthlyIncome ? Math.round(d.grossMonthlyIncome * 12) : app.incomeAnnual,
      employer: d.businessName || app.employer,
      // Create the extended record if the deal never had one (e.g. a photo/
      // FinanceIT entry), so ID and employment details can be filled in.
      loanApplication: {
        upsert: { create: loanData, update: loanData },
      },
    },
  });

  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'APPLICATION_UPDATE',
    entityType: 'Application',
    entityId: applicationId,
    detail: 'Deal edited by reviewer',
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  redirect(`/staff/applications/${applicationId}`);
}

// Reviewer/admin records a payout to the dealer (builds the payout receipt).
export async function recordPayoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const parsed = payoutSchema.safeParse({
    applicationId: formData.get('applicationId'),
    amount: formData.get('amount'),
    paidOn: formData.get('paidOn'),
    method: formData.get('method') || undefined,
    reference: formData.get('reference') || undefined,
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: 'Enter a valid amount and date.' };
  const d = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: d.applicationId } });
  if (!app) return { error: 'Application not found.' };

  const payout = await prisma.payout.create({
    data: {
      applicationId: d.applicationId,
      amount: d.amount,
      paidOn: new Date(d.paidOn),
      method: d.method || null,
      reference: d.reference || null,
      note: d.note || null,
      createdById: session.userId,
    },
  });
  await audit({
    actorId: session.userId,
    action: 'FUNDING_DECISION',
    entityType: 'Application',
    entityId: d.applicationId,
    detail: `Payout recorded: $${d.amount} (${payout.id})`,
  });
  await markReviewerAction(d.applicationId);

  revalidatePath(`/staff/applications/${d.applicationId}`);
  return { ok: true };
}

// Reviewer toggles a funding document's "completed/verified" state.
export async function toggleDocumentVerifiedAction(documentId: string): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  const verify = doc.verifiedAt === null;
  await prisma.document.update({
    where: { id: documentId },
    data: {
      verifiedAt: verify ? new Date() : null,
      verifiedById: verify ? session.userId : null,
    },
  });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Document',
    entityId: documentId,
    detail: verify ? 'Marked document completed' : 'Unmarked document',
  });
  await markReviewerAction(doc.applicationId);
  revalidatePath(`/staff/applications/${doc.applicationId}`);
}

// Reviewer marks every uploaded funding document as completed in one click.
export async function verifyAllFundingDocsAction(applicationId: string): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  await prisma.document.updateMany({
    where: { applicationId, stage: 'FUNDING', verifiedAt: null },
    data: { verifiedAt: new Date(), verifiedById: session.userId },
  });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: 'Marked all funding documents completed',
  });
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
}

/**
 * Move a deal to "In for funding" (FUNDING_REVIEW) — allowed only once every
 * required funding document type has at least one verified/completed document.
 */
export async function moveToInForFundingAction(applicationId: string): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { documents: { where: { stage: 'FUNDING' } } },
  });
  if (!app) return;
  if (app.status !== 'FUNDING_SUBMITTED') {
    revalidatePath(`/staff/applications/${applicationId}`);
    return;
  }

  const verifiedTypes = new Set(
    app.documents.filter((d) => d.verifiedAt !== null).map((d) => d.type),
  );
  const allRequiredVerified = FUNDING_DOCUMENT_TYPES.filter((t) => t.required).every((t) =>
    verifiedTypes.has(t.type),
  );
  if (!allRequiredVerified) {
    // Guard: not all required documents confirmed yet.
    revalidatePath(`/staff/applications/${applicationId}`);
    return;
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: 'FUNDING_REVIEW' } }),
    prisma.statusEvent.create({
      data: {
        applicationId,
        from: 'FUNDING_SUBMITTED',
        to: 'FUNDING_REVIEW',
        actorId: session.userId,
        note: 'All funding documents confirmed — moved to In for funding',
      },
    }),
  ]);
  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: applicationId, detail: 'FUNDING_REVIEW' });
  await markReviewerAction(applicationId);
  await notifyStatusChange(applicationId, 'FUNDING_REVIEW');
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
}

// Reviewer/admin manually sets a deal's status at any time (override/correct).
export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const parsed = statusChangeSchema.safeParse({
    applicationId: formData.get('applicationId'),
    status: formData.get('status'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: 'Pick a valid status.' };
  const { applicationId, status, note } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };
  if (app.status === status) return { ok: true };

  // A deal can't move into funding (or anything past it) until both reference
  // numbers are recorded.
  const FUNDING_OR_BEYOND: ApplicationStatus[] = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
  if (FUNDING_OR_BEYOND.includes(status) && (!app.hdReference || !app.financeItNumber)) {
    return {
      error: 'Add both the HD Customer # and the Financing deal number before moving this deal into funding.',
    };
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status } }),
    prisma.statusEvent.create({
      data: {
        applicationId,
        from: app.status,
        to: status,
        actorId: session.userId,
        note: note || 'Status changed manually',
      },
    }),
  ]);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Manual: ${app.status} -> ${status}${note ? ` (${note.slice(0, 200)})` : ''}`,
  });
  await markReviewerAction(applicationId);

  await notifyStatusChange(applicationId, status);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

// Reviewer/admin adds a note — to the dealer (internal=false) or internal-only.
export async function addStaffNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const parsed = noteSchema.safeParse({
    applicationId: formData.get('applicationId'),
    body: formData.get('body'),
    internal: formData.get('internal') === 'true',
  });
  if (!parsed.success) return { error: 'Write a note first.' };
  const { applicationId, body, internal } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };

  await prisma.note.create({ data: { applicationId, authorId: session.userId, body, internal } });
  await markReviewerAction(applicationId);
  await audit({ actorId: session.userId, action: 'DECISION', entityType: 'Application', entityId: applicationId, detail: internal ? 'Internal note' : 'Note to dealer' });
  if (!internal) await notifyNewNote(applicationId, 'REVIEWER');
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true };
}

// Reviewer/confirmer saves the confirmation script — draft save, complete, or
// flag an issue. "complete" requires all six confirmation boxes to be checked.
export async function saveConfirmationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const parsed = confirmationSchema.safeParse({
    applicationId: formData.get('applicationId'),
    intent: formData.get('intent'),
    productName: formData.get('productName') || undefined,
    numberOfCalls: formData.get('numberOfCalls') ?? undefined,
    city: formData.get('city') || undefined,
    district: formData.get('district') || undefined,
    phoneNumber: formData.get('phoneNumber') || undefined,
    installedWorking: formData.get('installedWorking'),
    performingAsRepresented: formData.get('performingAsRepresented'),
    receivedEverything: formData.get('receivedEverything'),
    financingAmount: formData.get('financingAmount') ?? undefined,
    termMonths: formData.get('termMonths') ?? undefined,
    firstInstallmentAmount: formData.get('firstInstallmentAmount') ?? undefined,
    firstInstallmentDate: formData.get('firstInstallmentDate') || undefined,
    termsAgreed: formData.get('termsAgreed'),
    signatureConfirmed: formData.get('signatureConfirmed'),
    notTrialOffer: formData.get('notTrialOffer'),
    specialArrangements: formData.get('specialArrangements') || undefined,
    hdNotes: formData.get('hdNotes') || undefined,
    issueNote: formData.get('issueNote') || undefined,
  });
  if (!parsed.success) return { error: 'Could not save the confirmation.' };
  const d = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: d.applicationId } });
  if (!app) return { error: 'Application not found.' };

  const allChecked =
    !!d.installedWorking &&
    !!d.performingAsRepresented &&
    !!d.receivedEverything &&
    !!d.termsAgreed &&
    !!d.signatureConfirmed &&
    !!d.notTrialOffer;

  if (d.intent === 'complete' && !allChecked) {
    return { error: 'Check all six confirmation boxes before completing.' };
  }

  const fields = {
    productName: d.productName || null,
    numberOfCalls: d.numberOfCalls ?? null,
    city: d.city || null,
    district: d.district || null,
    phoneNumber: d.phoneNumber || null,
    installedWorking: !!d.installedWorking,
    performingAsRepresented: !!d.performingAsRepresented,
    receivedEverything: !!d.receivedEverything,
    financingAmount: d.financingAmount ?? null,
    termMonths: d.termMonths ?? null,
    firstInstallmentAmount: d.firstInstallmentAmount ?? null,
    firstInstallmentDate: d.firstInstallmentDate ? new Date(d.firstInstallmentDate) : null,
    termsAgreed: !!d.termsAgreed,
    signatureConfirmed: !!d.signatureConfirmed,
    notTrialOffer: !!d.notTrialOffer,
    specialArrangements: d.specialArrangements || null,
    hdNotes: d.hdNotes || null,
    issueNote: d.issueNote || null,
  };

  const completing = d.intent === 'complete';
  await prisma.confirmation.upsert({
    where: { applicationId: d.applicationId },
    create: {
      applicationId: d.applicationId,
      ...fields,
      confirmedById: completing ? session.userId : null,
      completedAt: completing ? new Date() : null,
    },
    update: {
      ...fields,
      ...(completing ? { confirmedById: session.userId, completedAt: new Date() } : {}),
    },
  });

  const newStatus =
    d.intent === 'complete' ? 'COMPLETED' : d.intent === 'issue' ? 'ISSUE' : app.confirmationStatus;
  if (newStatus !== app.confirmationStatus) {
    await prisma.application.update({
      where: { id: d.applicationId },
      data: { confirmationStatus: newStatus },
    });
  }

  await audit({
    actorId: session.userId,
    action: 'DECISION',
    entityType: 'Application',
    entityId: d.applicationId,
    detail: `Confirmation ${d.intent}`,
  });
  await markReviewerAction(d.applicationId);

  revalidatePath(`/staff/applications/${d.applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/**
 * Write (or update) this deal's row in the Google Sheets sales journal.
 * Reviewer/admin only, and only once both the HD Customer # and the Financing
 * deal number are recorded. Best-effort: a Sheets failure never touches the
 * deal, it just returns an error for the reviewer to retry.
 */
export async function writeToJournalAction(
  applicationId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  if (!journalEnabled()) {
    return {
      error:
        'The sales journal is not connected yet (JOURNAL_SHEET_ID / Google credentials are missing on the server).',
    };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { homeDepotStore: true, dealer: true, loanApplication: true },
  });
  if (!app) return { error: 'Deal not found.' };
  if (!app.hdReference || !app.financeItNumber) {
    return { error: 'Add both the HD Customer # and the Financing deal number before writing to the journal.' };
  }

  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
  const fmtAmount = (a: unknown) => (a == null ? null : Number(a).toFixed(2));
  const storeLabel = app.homeDepotStore
    ? app.homeDepotStore.name
      ? `${app.homeDepotStore.name} - ${app.homeDepotStore.number}`
      : app.homeDepotStore.number
    : null;

  const deal: JournalDeal = {
    lastName: app.applicantLastName,
    firstName: app.applicantFirstName,
    hdReference: app.hdReference,
    financeItNumber: app.financeItNumber,
    hdStoreLabel: storeLabel,
    dealerName: app.dealer?.name ?? null,
    leadGenerator: app.leadGenerator,
    salesperson: app.salespersonName,
    installer: app.installerName,
    products: app.productsSold.length ? app.productsSold.join(', ') : null,
    soap: app.soapIncluded == null ? null : app.soapIncluded ? 'Yes' : 'No',
    financedAmount: fmtAmount(app.approvedAmount),
    term: null,
    address: decryptOptional(app.applicantAddressEnc),
    city: app.loanApplication?.city ?? null,
    province: app.province,
    postalCode: app.loanApplication?.postalCode ?? null,
    phone: app.applicantPhone,
    dealDate: fmtDate(app.dateOfSale),
    dateInstalled: fmtDate(app.installationDate),
    dateOfSale: fmtDate(app.dateOfSale),
    saleDate: app.dateOfSale ?? app.createdAt,
    knownTab: app.journalTab,
    knownRow: app.journalRow,
  };

  try {
    const result = await writeDealToJournal(deal);
    await prisma.application.update({
      where: { id: applicationId },
      data: { journalTab: result.tab, journalRow: result.row, journalSyncedAt: new Date() },
    });
    await markReviewerAction(applicationId);
    await audit({
      actorId: session.userId,
      action: 'JOURNAL_WRITE',
      entityType: 'Application',
      entityId: applicationId,
      detail: `Wrote to sales journal — ${result.tab} row ${result.row} (${result.wrote.length} fields)`,
    });
    revalidatePath(`/staff/applications/${applicationId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[journal] write failed', err);
    return { error: `Could not write to the journal: ${msg}` };
  }
}
