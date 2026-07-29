'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { storeFiles } from '@/lib/upload';
import {
  decisionSchema,
  payoutSchema,
  statusChangeSchema,
  noteSchema,
  confirmationSchema,
} from '@/lib/validation';
import { FUNDING_DOCUMENT_TYPES } from '@/lib/constants';
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

  await audit({
    actorId: session.userId,
    action: type === 'FUND' ? 'FUNDING_DECISION' : 'DECISION',
    entityType: 'Application',
    entityId: applicationId,
    detail: `${type}${notes ? `: ${notes.slice(0, 200)}` : ''}`,
  });

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
  revalidatePath(`/staff/applications/${applicationId}`);
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
  revalidatePath(`/staff/applications/${applicationId}`);
}

// Reviewer/admin uploads paperwork FOR the dealer (HD or Financing).
export async function uploadReviewerPaperworkAction(
  applicationId: string,
  docType: DocumentType,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Not found.' };

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
  });
  if (result.error) return result;

  revalidatePath(`/staff/applications/${applicationId}`);
  return {};
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
  await audit({ actorId: session.userId, action: 'DECISION', entityType: 'Application', entityId: applicationId, detail: internal ? 'Internal note' : 'Note to dealer' });
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

  revalidatePath(`/staff/applications/${d.applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}
