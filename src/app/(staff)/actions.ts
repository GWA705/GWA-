'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaffSection } from '@/lib/session';
import { audit } from '@/lib/audit';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { markReviewerAction } from '@/lib/activity';
import { encryptOptional, decryptOptional } from '@/lib/crypto';
import { toTitleCase, titleOrNull } from '@/lib/textcase';
import { mergeProductsSold, journalProductNames } from '@/lib/products';
import { writeDealToJournal, journalEnabled, type JournalDeal } from '@/lib/journal';
import { storeFiles } from '@/lib/upload';
import { deleteDocument } from '@/lib/storage';
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
import {
  fundingDocumentTypesFor,
  REVIEWER_PAPERWORK_PREFIX,
  REVIEWER_PAPERWORK_TYPES,
  VERIFICATION_CHECKS,
  applicableVerificationChecks,
  referenceGateError,
  approvalGateError,
  soapLabel,
} from '@/lib/constants';
import { dealHasFinancing, financedAmountOf, nonFinancedAmountOf, journalPayCode } from '@/lib/payments';
import type { ApplicationStatus, DecisionType, DocumentType, VerificationStatus } from '@prisma/client';

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

/**
 * Reviewer/admin deletes a document (e.g. a wrong install-paperwork file, to be
 * re-uploaded). Removes the stored file and the row, and audits it. A funding
 * document that's already been confirmed is protected — un-verify it first.
 */
export async function deleteDocumentAction(documentId: string): Promise<{ error?: string }> {
  const session = await requireStaffSection('review-queue');
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: 'Document not found.' };
  if (doc.verifiedAt) return { error: 'This document is confirmed — un-confirm it first, then delete.' };

  try {
    await deleteDocument(doc.storageKey);
  } catch (e) {
    // A missing storage object shouldn't block removing the row.
    console.error('[deleteDocument] storage delete failed', e);
  }
  await prisma.document.delete({ where: { id: documentId } });

  await markReviewerAction(doc.applicationId);
  await audit({
    actorId: session.userId,
    action: 'DOCUMENT_DELETE',
    entityType: 'Document',
    entityId: documentId,
    detail: `Deleted ${doc.fileName}`,
  });
  revalidatePath(`/staff/applications/${doc.applicationId}`);
  revalidatePath(`/dealer/applications/${doc.applicationId}`);
  return {};
}

/** Reviewer records/updates deal reference numbers after approval. */
export async function setDealReferencesAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffSection('review-queue');
  const parsed = dealReferencesSchema.safeParse({
    applicationId,
    financeItNumber: (formData.get('financeItNumber') as string) ?? '',
    hdReference: (formData.get('hdReference') as string) ?? '',
  });
  if (!parsed.success) return { error: 'Reference numbers can be up to 60 characters.' };

  const financeItNumber = parsed.data.financeItNumber?.trim() || null;
  const hdReference = parsed.data.hdReference?.trim() || null;
  const updated = await prisma.application.update({
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
  // Once a deal is decided, saving or correcting its numbers keeps the sales
  // journal in step automatically — so an HD Customer # that only came in after
  // approval lands in the journal without a second manual step. Best-effort: a
  // still-missing required number, or an unconfigured journal, is a silent no-op.
  if (JOURNAL_SYNC_STATUSES.includes(updated.status)) {
    await syncApplicationToJournal(applicationId, session.userId);
  }
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath(`/dealer/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Reviewer confirms (or un-confirms) that the financing/FinanceIT number on the
 * deal is valid — solidifying an approval, especially for dealer-auto-approved
 * (FinanceIT) deals where "approved" was dealer-asserted until now.
 */
export async function toggleFinanceNumberVerifiedAction(applicationId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return;
  const verifying = app.financeNumberVerifiedAt === null;
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      financeNumberVerifiedAt: verifying ? new Date() : null,
      financeNumberVerifiedById: verifying ? session.userId : null,
    },
  });
  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: verifying
      ? `Financing number verified (${app.financeItNumber ?? '—'})`
      : 'Financing number verification cleared',
  });
  revalidatePath(`/staff/applications/${applicationId}`);
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
  const session = await requireStaffSection('review-queue');

  const parsed = decisionSchema.safeParse({
    applicationId: formData.get('applicationId'),
    type: formData.get('type'),
    notes: formData.get('notes') || undefined,
    approvedAmount: formData.get('approvedAmount') ?? undefined,
    financeCompanyId: formData.get('financeCompanyId') || undefined,
    financeItNumber: (formData.get('financeItNumber') as string) || undefined,
    hdReference: (formData.get('hdReference') as string) || undefined,
  });
  if (!parsed.success) return { error: 'Invalid decision.' };
  const { applicationId, type, notes, approvedAmount, financeCompanyId, financeItNumber, hdReference } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };

  if (!isTransitionAllowed(app.status, type)) {
    return { error: `Cannot ${type.replace('_', ' ').toLowerCase()} an application in status ${app.status}.` };
  }

  // Funding a deal requires its reference numbers on file. The Financing deal
  // number is only required for financed deals (not cash/credit/HD credit card).
  if (type === 'FUND') {
    const refError = referenceGateError({ ...app, financed: dealHasFinancing(app) }, 'funding this deal');
    if (refError) return { error: refError };
  }

  // Hard gate (Rule 2): every applicable verification check must be Confirmed
  // before a deal can be funded.
  if (type === 'FUND') {
    const withChecks = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { financeCompany: true, verificationChecks: true },
    });
    const requiresSerials = !!withChecks?.financeCompany?.requiresSerialPerProduct;
    const applicable = applicableVerificationChecks(requiresSerials, !!withChecks?.taxExempt);
    const byKey = new Map((withChecks?.verificationChecks ?? []).map((v) => [v.key, v.status]));
    const outstanding = applicable.filter((c) => byKey.get(c.key) !== 'CONFIRMED');
    if (outstanding.length > 0) {
      return {
        error: 'Complete the funding verification checklist — every item must be Confirmed before funding.',
      };
    }
  }

  const to = nextStatus(type);

  // On an approval, record the approved amount, finance company, loan/approval
  // number, HD Customer #, and approver.
  const isApproval = type === 'APPROVE' || type === 'CONDITIONAL';
  // Effective values (what was just entered, else what's already on the deal).
  const effFinanceCompanyId = financeCompanyId ?? app.financeCompanyId;
  const effFinanceItNumber = (financeItNumber?.trim() || null) ?? app.financeItNumber;
  const effHdReference = (hdReference?.trim() || null) ?? app.hdReference;

  // Gate: nothing reaches an approved state without the finance company + loan
  // number (+ HD Customer # for HD deals).
  if (isApproval) {
    const gate = approvalGateError({
      financeCompanyId: effFinanceCompanyId,
      financeItNumber: effFinanceItNumber,
      hdReference: effHdReference,
      programType: app.programType,
    });
    if (gate) return { error: gate };
  }

  const approvalData = isApproval
    ? {
        approvedAmount: approvedAmount ?? app.approvedAmount ?? app.requestedAmount,
        financeCompanyId: effFinanceCompanyId,
        financeItNumber: effFinanceItNumber,
        hdReference: effHdReference,
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

  // Seed the sales journal the moment the deal is approved (best-effort). The
  // approval gate above guarantees the required numbers are present, so this
  // writes the row right away; a still-missing HD Customer # (on an auto-approved
  // deal) is picked up later by the reference-save sync. An unconfigured journal
  // or a failed write is a silent no-op — the manual button remains as a fallback.
  if (isApproval) {
    await syncApplicationToJournal(applicationId, session.userId);
  }

  if (to && to !== app.status) await notifyStatusChange(applicationId, to);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/** Move a submitted application into review (reviewer picks it up). */
export async function startReviewAction(applicationId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
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
  const session = await requireStaffSection('review-queue');
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
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Not found.' };

  const category = String(formData.get('category') || '');
  const allowed = REVIEWER_PAPERWORK_TYPES.map((t) => t.type) as string[];
  if (!allowed.includes(category)) return { error: 'Choose a paperwork type first.' };
  const docType = category as DocumentType;

  // "Other" carries a typed label that becomes the document's category name.
  let namePrefix = REVIEWER_PAPERWORK_PREFIX[docType];
  if (docType === 'OTHER') {
    const custom = String(formData.get('customLabel') || '').trim().replace(/[^\w\s-]/g, '').slice(0, 40);
    if (!custom) return { error: 'Type a name for this document.' };
    namePrefix = custom;
  }

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
    namePrefix,
  });
  if (result.error) return result;

  // Sending install paperwork advances an approved deal to "awaiting install",
  // so the dealer's status flips automatically the moment the documents are out.
  if (app.status === 'APPROVED' || app.status === 'CONDITIONAL') {
    await prisma.application.update({ where: { id: applicationId }, data: { status: 'DOCS_SENT' } });
    await prisma.statusEvent.create({
      data: {
        applicationId,
        from: app.status,
        to: 'DOCS_SENT',
        actorId: session.userId,
        note: 'Install documents sent to dealer',
      },
    });
  }

  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  return {};
}

/**
 * Toggle the reviewer's "my paperwork is done" marker on the awaiting-install
 * step. This is a team signal only — it never changes the deal status (which
 * still advances on its own when the dealer returns the signed package). Any
 * reviewer/admin can set or clear it; the name + time are snapshotted.
 */
export async function toggleReviewerDoneAction(applicationId: string): Promise<{ error?: string }> {
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, reviewerDoneAt: true },
  });
  if (!app) return { error: 'Not found.' };
  const nowDone = !app.reviewerDoneAt;
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      reviewerDoneAt: nowDone ? new Date() : null,
      reviewerDoneByName: nowDone ? session.name : null,
    },
  });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: nowDone ? 'reviewer marked paperwork complete' : 'reviewer un-marked paperwork complete',
  });
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
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Deal not found.' };

  const parsed = editDealSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
    return { error: 'Please correct the highlighted fields.', fieldErrors };
  }
  const d = parsed.data;

  // Reassigning a deal to a different dealer moves which dealership sees/owns it.
  // Validate the target dealer exists and record the move.
  const dealerChanged = d.dealerId !== app.dealerId;
  if (dealerChanged) {
    const target = await prisma.dealer.findUnique({ where: { id: d.dealerId }, select: { id: true, name: true } });
    if (!target) return { error: 'That dealer no longer exists.', fieldErrors: { dealerId: 'Unknown dealer' } };
  }

  const loanData = {
    middleName: d.middleName || null,
    homePhone: d.homePhone || null,
    maritalStatus: d.maritalStatus || null,
    housingStatus: d.housingStatus ?? null,
    monthlyHousingCostEnc: encryptOptional(d.monthlyHousingCost != null ? String(d.monthlyHousingCost) : null),
    monthlyHousingCost: null,
    yearsAtAddress: d.yearsAtAddress ?? null,
    city: d.city || null,
    addressProvince: d.addressProvince || null,
    postalCode: d.postalCode || null,
    idType: d.idType || null,
    idProvince: d.idProvince || null,
    idExpiry: d.idExpiry ? new Date(d.idExpiry) : null,
    businessName: d.businessName || null,
    positionTitle: d.positionTitle || null,
    employerAddressEnc: encryptOptional(d.employerAddress),
    employerAddress: null,
    employerPhone: d.employerPhone || null,
    grossMonthlyIncomeEnc: encryptOptional(d.grossMonthlyIncome != null ? String(d.grossMonthlyIncome) : null),
    grossMonthlyIncome: null,
    timeAtJobYears: d.timeAtJobYears ?? null,
    employmentStatus: d.employmentStatus ?? null,
  };

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      dealerId: d.dealerId,
      province: d.province,
      programType: d.programType,
      programCategory: d.programCategory,
      requestedAmount: d.requestedAmount,
      approvedAmount: d.approvedAmount ?? null,
      applicantFirstName: toTitleCase(d.applicantFirstName),
      applicantLastName: toTitleCase(d.applicantLastName),
      applicantEmail: d.applicantEmail,
      applicantPhone: d.applicantPhone,
      applicantDobEnc: encryptOptional(d.applicantDob),
      applicantAddressEnc: encryptOptional(d.applicantAddress),
      applicantCity: d.city || null,
      applicantPostal: d.postalCode || null,
      govIdNumberEnc: encryptOptional(d.govIdNumber),
      dateOfSale: d.dateOfSale ? new Date(d.dateOfSale) : null,
      installationDate: d.installationDate ? new Date(d.installationDate) : null,
      taxExempt: d.taxExempt,
      deliveredToReserve: d.taxExempt ? d.deliveredToReserve : false,
      statusCardNumberEnc: d.taxExempt
        ? (d.statusCardNumber ? encryptOptional(d.statusCardNumber) : app.statusCardNumberEnc)
        : null,
      bandName: d.taxExempt ? (d.bandName || null) : null,
      financingNote: d.financingNote || null,
      notes: d.notes || null,
      // Sales-journal detail fields (reviewer backfill).
      salespersonName: titleOrNull(d.salespersonName),
      installerName: titleOrNull(d.installerName),
      // '' = unspecified (null), 'NO' = no SOAP (false), any Yes-variant = true.
      soapIncluded: d.soapIncluded ? d.soapIncluded !== 'NO' : null,
      soapType: d.soapIncluded || null,
      productsSold: mergeProductsSold(
        formData.getAll('productsSold').map(String),
        formData.get('productsSoldOther') as string | null,
      ),
      incomeAnnualEnc: d.grossMonthlyIncome
        ? encryptOptional(String(Math.round(d.grossMonthlyIncome * 12)))
        : app.incomeAnnualEnc ?? encryptOptional(app.incomeAnnual != null ? String(app.incomeAnnual) : null),
      incomeAnnual: null,
      employer: titleOrNull(d.businessName) || app.employer,
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
    detail: dealerChanged
      ? `Deal edited by reviewer; reassigned dealer ${app.dealerId} → ${d.dealerId}`
      : 'Deal edited by reviewer',
  });
  if (dealerChanged) {
    // The old dealer's cache and the new dealer's list both need refreshing.
    revalidatePath('/dealer');
    revalidatePath('/staff');
  }
  revalidatePath(`/staff/applications/${applicationId}`);
  redirect(`/staff/applications/${applicationId}`);
}

// Reviewer/admin records a payout to the dealer (builds the payout receipt).
export async function recordPayoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffSection('review-queue');
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

  // Paid ⟹ funded. If the deal was paid before anyone clicked "Funded", fill in
  // the funded step automatically so both advance at once.
  if (app.status !== 'FUNDED') {
    await prisma.$transaction([
      prisma.application.update({ where: { id: d.applicationId }, data: { status: 'FUNDED' } }),
      prisma.statusEvent.create({
        data: { applicationId: d.applicationId, from: app.status, to: 'FUNDED', actorId: session.userId, note: 'Funded automatically on payout' },
      }),
    ]);
    await notifyStatusChange(d.applicationId, 'FUNDED');
  }
  await markReviewerAction(d.applicationId);

  revalidatePath(`/staff/applications/${d.applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/**
 * Reviewer marks a deal Funded straight from the "Awaiting funding" step, so
 * they don't have to go up to the status menu. Logs the funded date + who via
 * the status history.
 */
export async function markFundedAction(applicationId: string): Promise<{ error?: string }> {
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };
  if (app.status === 'FUNDED') return {};
  const refError = referenceGateError({ ...app, financed: dealHasFinancing(app) }, 'marking this deal funded');
  if (refError) return { error: refError };

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: 'FUNDED' } }),
    prisma.statusEvent.create({
      data: { applicationId, from: app.status, to: 'FUNDED', actorId: session.userId, note: 'Marked funded' },
    }),
  ]);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Marked funded (${app.status} -> FUNDED)`,
  });
  await markReviewerAction(applicationId);
  await notifyStatusChange(applicationId, 'FUNDED');
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  return {};
}

/**
 * Reviewer on-demand: read this deal's journal row and reflect its settlement —
 * if the journal shows OK + a Date Paid, mark it paid and auto-advance to Funded.
 */
export async function syncDealFromJournalAction(applicationId: string): Promise<{ error?: string; message?: string }> {
  const session = await requireStaffSection('review-queue');
  const { syncApplicationFromJournal } = await import('@/lib/journalPaidSync');
  const out = await syncApplicationFromJournal(applicationId, session.userId);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  if (out.error) return { error: `Couldn’t read the journal: ${out.error}` };
  if (out.skipped === 'not written to journal') {
    return { error: 'This deal hasn’t been written to the journal yet — use “Write to Journal” first, then check again.' };
  }
  if (out.skipped) return { error: out.skipped };
  if (out.funded) return { message: 'Journal shows this deal paid — marked Funded & Paid.' };
  if (out.paid) return { message: 'Journal shows this deal paid.' };
  return { message: `Checked — not paid yet. ${out.reason ?? 'The journal doesn’t show this deal paid.'}` };
}

// Reviewer toggles a funding document's "completed/verified" state.
export async function toggleDocumentVerifiedAction(documentId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
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

/** Reviewer triggers OCR (Tier 2) on a scanned/photo document on demand. */
export async function runDocumentOcrAction(documentId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { applicationId: true } });
  if (!doc) return;
  const { runDocumentOcr } = await import('@/lib/ocr');
  await runDocumentOcr(documentId);
  void session;
  revalidatePath(`/staff/applications/${doc.applicationId}`);
}

// Reviewer marks every uploaded funding document as completed in one click.
export async function verifyAllFundingDocsAction(applicationId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
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
  const session = await requireStaffSection('review-queue');
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
  const allRequiredVerified = fundingDocumentTypesFor(app.programType, {
    paymentMethod: app.paymentMethod,
    isSplitPayment: app.isSplitPayment,
  })
    .filter((t) => t.required)
    .every((t) => verifiedTypes.has(t.type));
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
  const session = await requireStaffSection('review-queue');
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

  // A deal can't reach an approved state (or anything past it) without the
  // finance company + loan number. (The HD Customer # is not required to approve;
  // it's added afterward.) Use the Approve form to add them — the manual status
  // change can't collect them.
  const APPROVED_OR_BEYOND: ApplicationStatus[] = [
    'CONDITIONAL', 'APPROVED', 'DOCS_SENT', 'FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED',
  ];
  if (APPROVED_OR_BEYOND.includes(status)) {
    const gate = approvalGateError({
      financeCompanyId: app.financeCompanyId,
      financeItNumber: app.financeItNumber,
      hdReference: app.hdReference,
      programType: app.programType,
    });
    if (gate) return { error: `${gate} (Use the Approve form to add them.)` };
  }

  // A deal can't move into funding (or anything past it) until its required
  // reference numbers are recorded.
  const FUNDING_OR_BEYOND: ApplicationStatus[] = ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'];
  if (FUNDING_OR_BEYOND.includes(status)) {
    const refError = referenceGateError({ ...app, financed: dealHasFinancing(app) }, 'moving this deal into funding');
    if (refError) return { error: refError };
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
  const session = await requireStaffSection('review-queue');
  const parsed = noteSchema.safeParse({
    applicationId: formData.get('applicationId'),
    body: formData.get('body'),
    internal: formData.get('internal') === 'true',
  });
  if (!parsed.success) return { error: 'Write a note first.' };
  const { applicationId, body, internal } = parsed.data;

  // Hard block: never store payment-card data.
  const card = findCardData(body);
  if (card.blocked) {
    await audit({ actorId: session.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: `Note blocked — card data detected (${card.signals.join(', ')})` });
    return { error: CARD_BLOCK_MESSAGE };
  }

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
  const session = await requireStaffSection('review-queue');
  // Default to a plain "save" when no button/intent came through (e.g. the form
  // was submitted by the phone keyboard's return key with no submit button).
  const rawIntent = String(formData.get('intent') || '');
  const intent = rawIntent === 'complete' || rawIntent === 'issue' ? rawIntent : 'save';
  const parsed = confirmationSchema.safeParse({
    applicationId: formData.get('applicationId'),
    intent,
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
  if (!parsed.success) {
    const labels: Record<string, string> = {
      numberOfCalls: '# of calls',
      productName: 'Product',
      city: 'City',
      district: 'District',
      phoneNumber: 'Phone',
      financingAmount: 'Financing $',
      termMonths: 'Over (months)',
      firstInstallmentAmount: '1st installment $',
      firstInstallmentDate: '1st installment date',
      specialArrangements: 'Special arrangements',
      hdNotes: 'HD confirmation notes',
      issueNote: 'Issue note',
    };
    const first = parsed.error.issues[0];
    const field = first?.path?.[0] ? String(first.path[0]) : '';
    const label = labels[field];
    return {
      error: label
        ? `Couldn’t save — please check the “${label}” field and try again.`
        : 'Could not save the confirmation. Please check the entries and try again.',
    };
  }
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
 * Reviewer sets a funding verification checklist item (Rule 2) to Confirmed or
 * Problem. A Problem requires a note, which is posted as a dealer-visible note
 * and notifies the dealer; the item is flagged but the whole deal is not moved
 * to Problem status. Confirming clears any prior problem note.
 */
export async function setVerificationCheckAction(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffSection('review-queue');

  const key = String(formData.get('key') || '');
  const status = String(formData.get('status') || '') as VerificationStatus;
  const note = ((formData.get('note') as string) || '').trim();

  const def = VERIFICATION_CHECKS.find((c) => c.key === key);
  if (!def) return { error: 'Unknown checklist item.' };
  if (status !== 'CONFIRMED' && status !== 'PROBLEM' && status !== 'PENDING') {
    return { error: 'Invalid status.' };
  }
  if (status === 'PROBLEM' && !note) {
    return { error: 'Add a short note describing the problem — the dealer will be notified.' };
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Deal not found.' };

  await prisma.verificationCheck.upsert({
    where: { applicationId_key: { applicationId, key } },
    create: {
      applicationId,
      key,
      status,
      note: status === 'PROBLEM' ? note : null,
      checkedById: session.userId,
      checkedAt: new Date(),
    },
    update: {
      status,
      note: status === 'PROBLEM' ? note : null,
      checkedById: session.userId,
      checkedAt: new Date(),
    },
  });

  // A flagged problem becomes a dealer-visible note and notifies the dealer.
  if (status === 'PROBLEM') {
    await prisma.note.create({
      data: {
        applicationId,
        authorId: session.userId,
        body: `Funding check — ${def.label}: ${note}`,
        internal: false,
      },
    });
    await notifyNewNote(applicationId, 'REVIEWER');
  }

  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Funding check "${def.label}" → ${status}`,
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Write (or update) this deal's row in the Google Sheets sales journal.
 * Reviewer/admin only, and only once both the HD Customer # and the Financing
 * deal number are recorded. Best-effort: a Sheets failure never touches the
 * deal, it just returns an error for the reviewer to retry.
 */
// Statuses at which a deal is "decided" and belongs in the sales journal. Used
// to gate the automatic journal sync so a still-in-review (or dead) deal never
// writes a row on its own — the manual button can still be used any time.
const JOURNAL_SYNC_STATUSES: ApplicationStatus[] = [
  'CONDITIONAL',
  'APPROVED',
  'DOCS_SENT',
  'FUNDING_SUBMITTED',
  'FUNDING_REVIEW',
  'FUNDED',
];

/**
 * Write (or update) a deal's row in the Google Sheets sales journal. Shared by
 * the manual "Write to Journal" button and the automatic syncs that fire on
 * approval and whenever a deal's reference numbers change. Best-effort by
 * contract — it reports a status instead of throwing, so an automatic caller can
 * ignore a skip or failure without derailing the decision or the reference save.
 *
 *  - 'disabled' — the journal isn't configured on this server (no-op).
 *  - 'skipped'  — a required reference number isn't present yet (message says
 *                 which); nothing was written.
 *  - 'error'    — the write was attempted but failed (message has the reason).
 *  - 'ok'       — written; the deal's journal tab / row / syncedAt are updated.
 */
async function syncApplicationToJournal(
  applicationId: string,
  actorId: string,
): Promise<{ status: 'ok' | 'skipped' | 'disabled' | 'error'; message?: string }> {
  if (!journalEnabled()) return { status: 'disabled' };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { homeDepotStore: true, dealer: true, loanApplication: true, financeCompany: true, paymentSplits: true },
  });
  if (!app) return { status: 'error', message: 'Deal not found.' };
  const refError = referenceGateError({ ...app, financed: dealHasFinancing(app) }, 'writing to the journal');
  if (refError) return { status: 'skipped', message: refError };

  const fmtDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
  const fmtAmount = (a: unknown) => (a == null ? null : Number(a).toFixed(2));
  const storeLabel = app.homeDepotStore
    ? app.homeDepotStore.name
      ? `${app.homeDepotStore.name} - ${app.homeDepotStore.number}`
      : app.homeDepotStore.number
    : null;

  // Journal writes the abbreviated product code (falls back to the full name).
  const journalProducts = await journalProductNames(app.productsSold, app.dealerId);

  // "How They Payed" code (col F) + the non-financed portion (col J, Cash/Chq/CC).
  const payCode = journalPayCode({
    programType: app.programType,
    paymentMethod: app.paymentMethod,
    financeCompanyName: app.financeCompany?.name ?? null,
    splitMethods: app.paymentSplits?.map((s) => s.method),
    hasFinancedPortion: dealHasFinancing(app),
  });
  const cashAmount = nonFinancedAmountOf(app);

  const deal: JournalDeal = {
    lastName: app.applicantLastName,
    firstName: app.applicantFirstName,
    hdReference: app.hdReference,
    financeItNumber: app.financeItNumber,
    hdStoreLabel: storeLabel,
    dealerName: app.dealer?.name ?? null,
    salesperson: app.salespersonName,
    installer: app.installerName,
    products: journalProducts.length ? journalProducts.join(', ') : null,
    soap: soapLabel(app.soapType, app.soapIncluded),
    payCode,
    financedAmount: fmtAmount(financedAmountOf(app)),
    cashAmount: cashAmount > 0 ? cashAmount.toFixed(2) : null,
    term: null,
    address: decryptOptional(app.applicantAddressEnc),
    city: app.applicantCity ?? app.loanApplication?.city ?? null,
    province: app.province,
    postalCode: app.applicantPostal ?? app.loanApplication?.postalCode ?? null,
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
    await audit({
      actorId,
      action: 'JOURNAL_WRITE',
      entityType: 'Application',
      entityId: applicationId,
      detail: `Wrote to sales journal — ${result.tab} row ${result.row} (${result.wrote.length} fields)`,
    });
    return { status: 'ok' };
  } catch (err) {
    console.error('[journal] write failed', err);
    return { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function writeToJournalAction(
  applicationId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffSection('review-queue');
  const res = await syncApplicationToJournal(applicationId, session.userId);
  if (res.status === 'disabled') {
    return {
      error:
        'The sales journal is not connected yet (JOURNAL_SHEET_ID / Google credentials are missing on the server).',
    };
  }
  if (res.status === 'skipped') return { error: res.message };
  if (res.status === 'error') return { error: `Could not write to the journal: ${res.message}` };
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true };
}
