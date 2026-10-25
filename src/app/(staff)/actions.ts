'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireStaffSection, requireAdminSection, requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { isOutOfBandReturn } from '@/lib/outOfBandReturn';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { markReviewerAction } from '@/lib/activity';
import { encryptOptional, decryptOptional } from '@/lib/crypto';
import { toTitleCase, titleOrNull } from '@/lib/textcase';
import { mergeProductsSold, journalProductNames } from '@/lib/products';
import { writeDealToJournal, writeCancellationToJournal, writeResultToJournal, clearJournalRow, journalEnabled, backfillJournalUnits, type JournalDeal, type BackfillUnitsDeal, type BackfillUnitsPlanRow } from '@/lib/journal';
import { storeFiles } from '@/lib/upload';
import { deleteDocument, getDocument } from '@/lib/storage';
import { notifyStatusChange, notifyNewNote, notifyCancellationResolved, notifyConfirmationIssue, notifyInBackground } from '@/lib/notify';
import { syncApplicationSoldStateToBooking } from '@/lib/bookingSold';
import { sendEmail, emailEnabled } from '@/lib/email';
import { sendSms, smsEnabled, toE164 } from '@/lib/sms';
import { buildReviewEmail, buildReviewSms } from '@/lib/reviewRequest';
import { buildDocsEmail } from '@/lib/customerDocsEmail';
import { makeDocLinkToken, DOC_LINK_TTL_DAYS } from '@/lib/docLink';
import { getOrCreateDealConversation, postChatMessage } from '@/lib/chat';
import { getReviewLink, setSetting, REVIEW_SETTING_KEYS } from '@/lib/settings';
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
  REVIEWER_PAPERWORK_PREFIX,
  REVIEWER_PAPERWORK_TYPES,
  VERIFICATION_CHECKS,
  applicableVerificationChecks,
  referenceGateError,
  approvalGateError,
  hdReferenceRequired,
  soapLabel,
} from '@/lib/constants';
import { dealHasFinancing, financedAmountOf, nonFinancedAmountOf, journalPayCode } from '@/lib/payments';
import { syncApplicationToJournal } from '@/lib/journalSync';
import { findFinanceitEmailForDeal, financeitEmailConfigured } from '@/lib/financeitEmail';
import { getT } from '@/i18n/server';
import type { ApplicationStatus, DecisionType, DocumentType, VerificationStatus, ProgramType, Prisma } from '@prisma/client';

export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return { error: t('actionMsg.staff.documentNotFound') };
  if (doc.verifiedAt) return { error: t('actionMsg.staff.docConfirmedUnconfirm') };

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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const parsed = dealReferencesSchema.safeParse({
    applicationId,
    financeItNumber: (formData.get('financeItNumber') as string) ?? '',
    hdReference: (formData.get('hdReference') as string) ?? '',
  });
  if (!parsed.success) return { error: t('actionMsg.staff.refNumbersMaxLength') };

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

/**
 * Pull the deal's details from FinanceIt's own approval/funding email and fill in
 * anything the confirmer is missing — financing amount, term, monthly payment,
 * phone — and confirm the FinanceIt loan number straight from the lender. Only
 * fills BLANK fields (never overwrites a human's entry), and matches the email to
 * the deal by loan number, then phone, then name. Read-only on the mailbox side.
 */
export async function pullFinanceitInfoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireStaffSection('review-queue');
  const applicationId = String(formData.get('applicationId') ?? '');
  if (!applicationId) return { error: 'Missing deal id.' };
  if (!financeitEmailConfigured()) {
    return { error: 'FinanceIt email lookup isn’t set up on this environment yet.' };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { confirmation: true },
  });
  if (!app) return { error: 'Deal not found.' };

  const { best, finalized, matchedBy } = await findFinanceitEmailForDeal({
    loanNumber: app.financeItNumber,
    firstName: app.applicantFirstName,
    lastName: app.applicantLastName,
    phone: app.applicantPhone,
  });

  if (!best) {
    return {
      ok: true,
      message:
        'No FinanceIt email found for this customer yet (searched by loan number, phone and name). It usually arrives within a minute of approval.',
    };
  }

  const filled: string[] = [];

  // Application-level fields — only fill blanks, never overwrite.
  const appData: {
    financeItNumber?: string;
    applicantEmail?: string;
    applicantPhone?: string;
    financeNumberVerifiedAt?: Date;
    financeNumberVerifiedById?: string;
  } = {};
  let confirmNumber = false;
  const dealNumber = (app.financeItNumber ?? '').replace(/\D/g, '');

  if (!app.financeItNumber?.trim() && best.loanNumber) {
    appData.financeItNumber = best.loanNumber;
    filled.push(`FinanceIt # ${best.loanNumber}`);
    confirmNumber = true;
  } else if (dealNumber && best.loanNumber && dealNumber === best.loanNumber) {
    confirmNumber = true; // the deal's number matches the lender's record
  }

  if ((!app.applicantEmail || !app.applicantEmail.includes('@')) && best.email) {
    appData.applicantEmail = best.email;
    filled.push(`email ${best.email}`);
  }
  if (!app.applicantPhone?.trim() && best.phone) {
    appData.applicantPhone = best.phone;
    filled.push(`phone ${best.phone}`);
  }
  if (confirmNumber && !app.financeNumberVerifiedAt) {
    appData.financeNumberVerifiedAt = new Date();
    appData.financeNumberVerifiedById = session.userId;
    filled.push('verified the FinanceIt number');
  }
  if (Object.keys(appData).length) {
    await prisma.application.update({ where: { id: applicationId }, data: appData });
  }

  // Confirmer's sheet — fill the terms block where it's still blank.
  const c = app.confirmation;
  const confData: {
    phoneNumber?: string;
    financingAmount?: number;
    termMonths?: number;
    firstInstallmentAmount?: number;
    productName?: string;
  } = {};
  if (c?.phoneNumber == null && best.phone) {
    confData.phoneNumber = best.phone;
  }
  if (c?.financingAmount == null && best.purchaseAmount != null) {
    confData.financingAmount = best.purchaseAmount;
    filled.push(`financing amount $${best.purchaseAmount.toFixed(2)}`);
  }
  if (c?.termMonths == null && best.termMonths != null) {
    confData.termMonths = best.termMonths;
    filled.push(`term ${best.termMonths} months`);
  }
  if (c?.firstInstallmentAmount == null && best.monthlyPayment != null) {
    confData.firstInstallmentAmount = best.monthlyPayment;
    filled.push(`monthly payment $${best.monthlyPayment.toFixed(2)}`);
  }
  if (!c?.productName && best.purchaseType) {
    confData.productName = best.purchaseType;
  }
  if (Object.keys(confData).length) {
    await prisma.confirmation.upsert({
      where: { applicationId },
      create: { applicationId, ...confData },
      update: confData,
    });
  }

  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Pulled FinanceIt email (matched by ${matchedBy}); ${filled.length ? `filled ${filled.join(', ')}` : 'nothing missing'}`,
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath(`/dealer/applications/${applicationId}`);

  const fundedNote =
    finalized && app.status !== 'FUNDED'
      ? ' FinanceIt shows this loan is FUNDED & finalized — you may want to mark the deal Funded.'
      : '';
  const matchNote = matchedBy ? ` (matched by ${matchedBy.replace('-', ' ')})` : '';
  const body = filled.length
    ? `Pulled from FinanceIt${matchNote}. Filled: ${filled.join(', ')}.`
    : `FinanceIt email found${matchNote}, but everything was already filled in.`;
  return { ok: true, message: body + fundedNote };
}

// The confirmer flow's tap-to-log call attempts (replaces hand-typed call dates).
const ATTEMPT_OUTCOMES = ['NO_ANSWER', 'LEFT_VM', 'BUSY', 'REACHED'] as const;

/** Log one confirmation-call attempt (a single tap). The confirmation's call
 *  count is kept in step automatically, so reporting never needs a typed number. */
export async function logConfirmationAttemptAction(applicationId: string, outcome: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
  if (!applicationId || !(ATTEMPT_OUTCOMES as readonly string[]).includes(outcome)) return;
  await prisma.confirmationAttempt.create({
    data: { applicationId, outcome, createdById: session.userId },
  });
  const count = await prisma.confirmationAttempt.count({ where: { applicationId } });
  await prisma.confirmation.upsert({
    where: { applicationId },
    create: { applicationId, numberOfCalls: count },
    update: { numberOfCalls: count },
  });
  await markReviewerAction(applicationId);
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Confirmation attempt: ${outcome.toLowerCase().replace('_', ' ')}`,
  });
  revalidatePath(`/staff/applications/${applicationId}`);
}

/** Remove a logged attempt (mis-tap). Re-derives the call count. */
export async function removeConfirmationAttemptAction(attemptId: string): Promise<void> {
  const session = await requireStaffSection('review-queue');
  const row = await prisma.confirmationAttempt.findUnique({ where: { id: attemptId }, select: { applicationId: true } });
  if (!row) return;
  await prisma.confirmationAttempt.delete({ where: { id: attemptId } });
  const count = await prisma.confirmationAttempt.count({ where: { applicationId: row.applicationId } });
  await prisma.confirmation.updateMany({ where: { applicationId: row.applicationId }, data: { numberOfCalls: count } });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: row.applicationId,
    detail: 'Confirmation attempt removed',
  });
  revalidatePath(`/staff/applications/${row.applicationId}`);
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
  const t = getT();
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
  if (!parsed.success) return { error: t('actionMsg.staff.invalidDecision') };
  const { applicationId, type, notes, approvedAmount, financeCompanyId, financeItNumber, hdReference } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };

  if (!isTransitionAllowed(app.status, type)) {
    return { error: t('actionMsg.staff.cannotTransition', { action: type.replace('_', ' ').toLowerCase(), status: app.status }) };
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
        error: t('actionMsg.staff.completeVerificationChecklist'),
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
      paymentMethod: app.paymentMethod,
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

export interface CancellationActionState {
  error?: string;
  ok?: boolean;
}

/**
 * A reviewer confirms a dealer's cancellation request, finalizing it: the deal is
 * set to WITHDRAWN. For a deal that was already funded, the reviewer must confirm
 * the Home Depot refund was processed first (tick the box) — that's the whole
 * reason a funded cancellation can't be finalized automatically.
 */
export async function confirmCancellationAction(
  cancellationId: string,
  _prev: CancellationActionState,
  formData: FormData,
): Promise<CancellationActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const c = await prisma.dealCancellation.findUnique({ where: { id: cancellationId }, include: { application: true, requestedBy: true } });
  if (!c) return { error: t('actionMsg.notFound') };
  if (c.status !== 'PENDING') return { error: t('actionMsg.staff.requestAlreadyResolved') };

  const hdRefundConfirmed = formData.get('hdRefundConfirmed') === 'on' || formData.get('hdRefundConfirmed') === '1';
  if (c.wasFunded && !hdRefundConfirmed) {
    return { error: t('actionMsg.staff.confirmHdRefund') };
  }
  const note = (formData.get('note') ?? '').toString().trim().slice(0, 2000) || null;

  const trail = [
    `✅ Cancellation confirmed by a reviewer. The deal is now closed.`,
    c.wasFunded ? `Home Depot refund confirmed.` : null,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(' ');

  await prisma.$transaction([
    prisma.dealCancellation.update({
      where: { id: cancellationId },
      data: { status: 'CONFIRMED', handledById: session.userId, handledAt: new Date(), reviewerNote: note, hdRefundConfirmed: c.wasFunded ? true : hdRefundConfirmed },
    }),
    prisma.application.update({ where: { id: c.applicationId }, data: { status: 'WITHDRAWN' } }),
    prisma.statusEvent.create({
      data: {
        applicationId: c.applicationId,
        from: c.application.status,
        to: 'WITHDRAWN',
        actorId: session.userId,
        note: `Cancellation confirmed${c.wasFunded ? ' (Home Depot refund processed)' : ''}`,
      },
    }),
    // Dealer-visible note so the confirmation (and HD refund) lives on the file.
    prisma.note.create({ data: { applicationId: c.applicationId, authorId: session.userId, body: trail, internal: false } }),
  ]);

  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'DealCancellation', entityId: cancellationId, detail: 'Cancellation confirmed → WITHDRAWN' });

  // Reverse the sale in the booking system (this path withdraws the deal — a
  // funded one included — without going through notifyStatusChange, so the
  // booking sync is triggered explicitly here). Fire-and-forget, inert until the
  // booking feed is configured.
  notifyInBackground('booking sold reverse', () => syncApplicationSoldStateToBooking(c.applicationId, 'WITHDRAWN'));

  // Mark the deal RB in the sales journal, with a cell note explaining why —
  // reason, who confirmed it, and which dealer user requested it, dated. Best-
  // effort: a journal hiccup never blocks the cancellation.
  if (journalEnabled() && c.application.journalTab && c.application.journalRow) {
    try {
      const confirmer = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
      const today = new Date().toLocaleDateString('en-CA');
      const noteLines = [
        `RB — deal cancelled (${today}).`,
        `Reason: ${c.reason}`,
        `Confirmed in the portal by: ${confirmer?.name ?? 'a reviewer'}.`,
        `Requested by dealer: ${c.requestedBy?.name ?? 'unknown'}.`,
        c.wasFunded ? 'Was funded — Home Depot refund confirmed.' : null,
        note ? `Reviewer note: ${note}` : null,
      ].filter(Boolean).join('\n');
      const saleYear = (c.application.dateOfSale ?? c.application.createdAt).getFullYear();
      const rb = await writeCancellationToJournal(
        { knownTab: c.application.journalTab, knownRow: c.application.journalRow, lastName: c.application.applicantLastName, saleYear },
        noteLines,
      );
      await audit({
        actorId: session.userId,
        action: 'STATUS_CHANGE',
        entityType: 'Application',
        entityId: c.applicationId,
        detail: rb.ok ? 'Journal marked RB with cancellation note' : `Journal RB write skipped: ${rb.error}`,
      });
    } catch (e) {
      console.error('[cancellation] journal RB write failed', e);
    }
  }

  await notifyCancellationResolved(c.applicationId, true, note);
  revalidatePath(`/staff/applications/${c.applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/** A reviewer rejects a dealer's cancellation request; the deal stays active. */
export async function rejectCancellationAction(
  cancellationId: string,
  _prev: CancellationActionState,
  formData: FormData,
): Promise<CancellationActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const c = await prisma.dealCancellation.findUnique({ where: { id: cancellationId } });
  if (!c) return { error: t('actionMsg.notFound') };
  if (c.status !== 'PENDING') return { error: t('actionMsg.staff.requestAlreadyResolved') };

  const note = (formData.get('note') ?? '').toString().trim().slice(0, 2000) || null;
  const trail = [`↩️ Cancellation request declined by a reviewer. The deal remains active.`, note ? `Note: ${note}` : null].filter(Boolean).join(' ');
  await prisma.$transaction([
    prisma.dealCancellation.update({
      where: { id: cancellationId },
      data: { status: 'REJECTED', handledById: session.userId, handledAt: new Date(), reviewerNote: note },
    }),
    prisma.note.create({ data: { applicationId: c.applicationId, authorId: session.userId, body: trail, internal: false } }),
  ]);

  await audit({ actorId: session.userId, action: 'STATUS_CHANGE', entityType: 'DealCancellation', entityId: cancellationId, detail: 'Cancellation rejected' });
  await notifyCancellationResolved(c.applicationId, false, note);
  revalidatePath(`/staff/applications/${c.applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

/**
 * Reactivate a cancelled deal — turn a WITHDRAWN deal back into an active deal.
 * Reverses a confirmed cancellation that was entered by mistake (or fell through).
 * Restores the deal to the status it held immediately before it was withdrawn,
 * records the reversal on the cancellation record + the status history, leaves a
 * dealer-visible note, and best-effort un-marks the journal row (RB → OK/PE-OK)
 * so the sheet matches the portal again and the paid/RB syncs don't re-cancel it.
 */
export async function reactivateDealAction(
  applicationId: string,
  _prev: CancellationActionState,
  formData: FormData,
): Promise<CancellationActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      statusEvents: { orderBy: { createdAt: 'desc' } },
      cancellations: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!app) return { error: t('actionMsg.notFound') };
  if (app.status !== 'WITHDRAWN') {
    return { error: t('actionMsg.staff.notCancelled') };
  }

  const note = (formData.get('note') ?? '').toString().trim().slice(0, 2000) || null;

  // Restore to the status the deal held right before it was withdrawn: the `from`
  // of the most recent "→ WITHDRAWN" status event, else the cancellation's stored
  // priorStatus, else a safe default of UNDER_REVIEW.
  const withdrawnEvent = app.statusEvents.find((e) => e.to === 'WITHDRAWN');
  const lastCancellation = app.cancellations.find((c) => c.status === 'CONFIRMED') ?? app.cancellations[0];
  const restoreStatus: ApplicationStatus = withdrawnEvent?.from ?? lastCancellation?.priorStatus ?? 'UNDER_REVIEW';

  const confirmer = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
  const statusWords = restoreStatus.replace(/_/g, ' ').toLowerCase();
  const trail = [
    `↩️ Deal reactivated by ${confirmer?.name ?? 'a reviewer'} — it is active again (${statusWords}).`,
    note ? `Note: ${note}` : null,
  ].filter(Boolean).join(' ');

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.application.update({ where: { id: applicationId }, data: { status: restoreStatus } }),
    prisma.statusEvent.create({
      data: {
        applicationId,
        from: 'WITHDRAWN',
        to: restoreStatus,
        actorId: session.userId,
        note: `Deal reactivated${note ? ` — ${note}` : ''}`,
      },
    }),
    prisma.note.create({ data: { applicationId, authorId: session.userId, body: trail, internal: false } }),
  ];
  // Mark the confirmed cancellation as reversed so history stays honest.
  if (lastCancellation && lastCancellation.status === 'CONFIRMED') {
    ops.push(
      prisma.dealCancellation.update({
        where: { id: lastCancellation.id },
        data: { status: 'REVERSED', reviewerNote: note },
      }),
    );
  }
  await prisma.$transaction(ops);

  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Deal reactivated (WITHDRAWN → ${restoreStatus})`,
  });

  // Best-effort: put the journal Result back (OK if already paid, else PE/OK) with
  // a note, so the sheet matches the portal and the paid/RB syncs don't re-cancel.
  if (journalEnabled() && app.journalTab && app.journalRow) {
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const resultValue = app.datePaid ? 'OK' : 'PE/OK';
      const noteLines = [
        `Reactivated (${today}) — cancellation reversed in the portal.`,
        `By: ${confirmer?.name ?? 'a reviewer'}.`,
        note ? `Note: ${note}` : null,
      ].filter(Boolean).join('\n');
      const saleYear = (app.dateOfSale ?? app.createdAt).getFullYear();
      const r = await writeResultToJournal(
        { knownTab: app.journalTab, knownRow: app.journalRow, lastName: app.applicantLastName, saleYear },
        resultValue,
        noteLines,
      );
      await audit({
        actorId: session.userId,
        action: 'STATUS_CHANGE',
        entityType: 'Application',
        entityId: applicationId,
        detail: r.ok ? `Journal result restored to ${resultValue}` : `Journal restore skipped: ${r.error}`,
      });
    } catch (e) {
      console.error('[reactivate] journal result write failed', e);
    }
  }

  await notifyStatusChange(applicationId, restoreStatus);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  return { ok: true };
}

// Reviewer/admin uploads paperwork FOR the dealer. The category is chosen from
// a dropdown and arrives in the form data (one drop zone for all types).
export async function uploadReviewerPaperworkAction(
  applicationId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const tr = getT();
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: tr('actionMsg.notFound') };

  // Rule: an HD-program deal must carry its HD Customer # before install
  // paperwork goes to the dealer. The deal can be approved (and journalled)
  // without it, but the number has to be recorded before the documents are sent.
  if (hdReferenceRequired(app.programType) && !app.hdReference?.trim()) {
    return { error: tr('actionMsg.staff.addHdCustomerNumber') };
  }

  const category = String(formData.get('category') || '');
  const allowed = REVIEWER_PAPERWORK_TYPES.map((t) => t.type) as string[];
  if (!allowed.includes(category)) return { error: tr('actionMsg.staff.choosePaperworkType') };
  const docType = category as DocumentType;

  // "Other" carries a typed label that becomes the document's category name.
  let namePrefix = REVIEWER_PAPERWORK_PREFIX[docType];
  if (docType === 'OTHER') {
    const custom = String(formData.get('customLabel') || '').trim().replace(/[^\w\s-]/g, '').slice(0, 40);
    if (!custom) return { error: tr('actionMsg.staff.typeDocumentName') };
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, reviewerDoneAt: true },
  });
  if (!app) return { error: t('actionMsg.notFound') };
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

  const parsed = editDealSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
    return { error: t('actionMsg.correctHighlighted'), fieldErrors };
  }
  const d = parsed.data;

  // Reassigning a deal to a different dealer moves which dealership sees/owns it.
  // Validate the target dealer exists and record the move.
  const dealerChanged = d.dealerId !== app.dealerId;
  if (dealerChanged) {
    const target = await prisma.dealer.findUnique({ where: { id: d.dealerId }, select: { id: true, name: true } });
    if (!target) return { error: t('actionMsg.staff.dealerGone'), fieldErrors: { dealerId: 'Unknown dealer' } };
  }

  // Finance company (optional) — if one was chosen, make sure it still exists
  // before we point the deal at it.
  const financeCompanyId = d.financeCompanyId || null;
  if (financeCompanyId) {
    const fc = await prisma.financeCompany.findUnique({ where: { id: financeCompanyId }, select: { id: true } });
    if (!fc) return { error: t('actionMsg.staff.financeCompanyGone'), fieldErrors: { financeCompanyId: 'Unknown finance company' } };
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
      // Financing — reviewer-editable. A blank finance company / loan number /
      // HD # clears it; the payment method drives the finance-company display and
      // the funding-doc requirements for Express deals.
      paymentMethod: d.paymentMethod ?? null,
      financeCompanyId,
      financeItNumber: d.financeItNumber || null,
      hdReference: d.hdReference || null,
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
  // An edit can change anything the sales journal shows (amounts, products,
  // finance company, loan / HD numbers) — keep the journal in step for a deal
  // that's already been written there. Best-effort: an unconfigured journal or a
  // still-missing required number is a silent no-op.
  if (JOURNAL_SYNC_STATUSES.includes(app.status)) {
    await syncApplicationToJournal(applicationId, session.userId);
  }
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const parsed = payoutSchema.safeParse({
    applicationId: formData.get('applicationId'),
    amount: formData.get('amount'),
    paidOn: formData.get('paidOn'),
    method: formData.get('method') || undefined,
    reference: formData.get('reference') || undefined,
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: t('actionMsg.staff.enterValidAmountDate') };
  const d = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: d.applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };

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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const { syncApplicationFromJournal } = await import('@/lib/journalPaidSync');
  const out = await syncApplicationFromJournal(applicationId, session.userId);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff');
  if (out.error) return { error: t('actionMsg.staff.couldntReadJournal', { error: out.error }) };
  if (out.skipped === 'not written to journal') {
    return { error: t('actionMsg.staff.notWrittenToJournal') };
  }
  if (out.skipped) return { error: out.skipped };
  if (out.cancelled) return { message: t('actionMsg.staff.journalCancelled') };
  if (out.funded) return { message: t('actionMsg.staff.journalPaidFunded') };
  if (out.paid) return { message: t('actionMsg.staff.journalPaid') };
  return { message: t('actionMsg.staff.checkedNotPaid', { reason: out.reason ?? t('actionMsg.staff.journalNotPaidReason') }) };
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
  // Advanceable once the signed package is back and confirmed. Normally the deal
  // is FUNDING_SUBMITTED (dealer returned it through the portal), but a package
  // can land while it's still DOCS_SENT (uploaded to the wrong box, or by staff),
  // in which case the status never flipped — accept that too so the deal doesn't
  // strand at "Review signed documents" with everything confirmed and no way on.
  if (app.status !== 'FUNDING_SUBMITTED' && app.status !== 'DOCS_SENT') {
    revalidatePath(`/staff/applications/${applicationId}`);
    return;
  }

  // The reviewer is the gate: the deal can move once every uploaded funding
  // document is confirmed (verified) and at least one exists. We do NOT require
  // each required document *type* to be present — a doc filed under the "wrong"
  // category used to silently strand the deal here. The required-type list on the
  // page still flags anything missing as guidance for the reviewer.
  const fundingDocs = app.documents; // already scoped to stage FUNDING
  const allUploadedConfirmed = fundingDocs.length > 0 && fundingDocs.every((d) => d.verifiedAt !== null);
  if (!allUploadedConfirmed) {
    // Guard: still has an unconfirmed (or zero) uploaded document.
    revalidatePath(`/staff/applications/${applicationId}`);
    return;
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: 'FUNDING_REVIEW' } }),
    prisma.statusEvent.create({
      data: {
        applicationId,
        from: app.status,
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

export interface StuckFundingDeal {
  id: string;
  name: string;
  dealerName: string;
  total: number; // uploaded funding docs
  unconfirmed: number; // of those, not yet confirmed
  hasDocs: boolean;
  ready: boolean; // has docs AND all confirmed → can advance now
  outOfBand: boolean; // stuck at Approved/Conditional (install docs never sent) vs submitted
}

// A deal "stuck in funding" is either sitting at In-for-funding submitted, OR
// sitting at Approved/Conditional as an out-of-band return (signed package back,
// install docs never sent through the portal). Both need the same nudge to In
// for funding. This loads the candidates with everything both cases need.
async function loadStuckFundingCandidates() {
  const rows = await prisma.application.findMany({
    where: { status: { in: ['FUNDING_SUBMITTED', 'APPROVED', 'CONDITIONAL'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      applicantFirstName: true,
      applicantLastName: true,
      dealer: { select: { name: true } },
      documents: { where: { stage: 'FUNDING' }, select: { type: true, verifiedAt: true } },
      statusEvents: { select: { to: true } },
    },
  });
  return rows
    .map((a) => {
      const fundingDocs = a.documents;
      const outOfBand =
        a.status !== 'FUNDING_SUBMITTED' &&
        isOutOfBandReturn({
          status: a.status,
          fundingDocTypes: fundingDocs.map((d) => d.type),
          statusHistoryTos: a.statusEvents.map((e) => e.to),
        });
      // Include submitted deals always; Approved/Conditional only when out-of-band.
      const include = a.status === 'FUNDING_SUBMITTED' || outOfBand;
      const total = fundingDocs.length;
      const unconfirmed = fundingDocs.filter((d) => d.verifiedAt === null).length;
      return {
        id: a.id,
        status: a.status,
        name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
        dealerName: a.dealer.name,
        total,
        unconfirmed,
        hasDocs: total > 0,
        ready: total > 0 && unconfirmed === 0,
        outOfBand,
        include,
      };
    })
    .filter((a) => a.include);
}

/** How many deals are eligible for the one-click bulk advance (below). */
export async function countReadyFundingDeals(): Promise<number> {
  return (await loadStuckFundingCandidates()).filter((a) => a.ready).length;
}

/**
 * Every deal stuck in funding, oldest first, with why each is (or isn't) ready to
 * advance. Powers the admin "Funding queue" list. Includes both In-for-funding
 * submitted deals and out-of-band Approved/Conditional deals (install docs never
 * sent, signed package returned).
 */
export async function listStuckFundingDeals(): Promise<StuckFundingDeal[]> {
  const rows = await loadStuckFundingCandidates();
  return rows.map(({ id, name, dealerName, total, unconfirmed, hasDocs, ready, outOfBand }) => ({
    id, name, dealerName, total, unconfirmed, hasDocs, ready, outOfBand,
  }));
}

/** Advance one stuck deal to In for funding (banner button + reused by bulk). */
async function moveStuckDealToInForFunding(id: string, from: ApplicationStatus, actorId: string): Promise<void> {
  await prisma.$transaction([
    prisma.application.update({ where: { id }, data: { status: 'FUNDING_REVIEW' } }),
    prisma.statusEvent.create({
      data: { applicationId: id, from, to: 'FUNDING_REVIEW', actorId, note: 'Advanced to In for funding — uploaded documents confirmed' },
    }),
  ]);
  await audit({ actorId, action: 'STATUS_CHANGE', entityType: 'Application', entityId: id, detail: `Advance to FUNDING_REVIEW (from ${from})` });
}

/**
 * One-click backlog cleanup: advance every stuck deal (submitted OR out-of-band
 * Approved/Conditional) whose uploaded funding documents are ALL already
 * confirmed to "In for funding" (FUNDING_REVIEW). Deliberately: moves ONLY to In
 * for funding (never Funded), only docs-confirmed deals, logs each move; dealer
 * notifications are skipped so a sweep doesn't flood them.
 */
export async function advanceReadyFundingDealsAction(): Promise<{ moved: number }> {
  const session = await requireAdminSection('overview');
  const ready = (await loadStuckFundingCandidates()).filter((a) => a.ready);
  let moved = 0;
  for (const a of ready) {
    await moveStuckDealToInForFunding(a.id, a.status, session.userId);
    moved += 1;
  }
  revalidatePath('/admin');
  revalidatePath('/staff');
  return { moved };
}

// --- Legacy-deal reconciliation (admin) -----------------------------------
// Some deals were approved but never carried through to Funded in the portal —
// e.g. GWA direct sales and older deals that predate the current flow. They're
// settled in real life; staff just need to mark them Funded here, then fill in
// the sales journal as usual (the journal paid-sync then marks them Paid). This
// is a deliberate, reviewed, admin-only bulk action — never automatic.

export interface ReconcileCandidate {
  id: string;
  name: string;
  dealerName: string;
  programType: ProgramType;
  status: ApplicationStatus;
  amount: number;
  dateOfSale: string | null; // ISO
  createdAt: string; // ISO
  hdReference: string | null;
  financeItNumber: string | null;
  // When set, the deal can't be marked Funded until this is fixed (same gate as
  // the normal "mark funded" — e.g. a missing HD Customer # or financing number).
  blockedReason: string | null;
}

/** Deals sitting at Approved/Conditional that haven't been funded or paid. */
export async function listReconcileCandidates(): Promise<ReconcileCandidate[]> {
  await requireAdminSection('overview');
  const rows = await prisma.application.findMany({
    where: { status: { in: ['APPROVED', 'CONDITIONAL'] }, journalPaidOn: null },
    orderBy: { createdAt: 'asc' },
    include: { dealer: { select: { name: true } }, _count: { select: { payouts: true } } },
  });
  return rows
    .filter((a) => a._count.payouts === 0) // not already paid out
    .map((a) => {
      const financed = dealHasFinancing(a);
      const blockedReason = referenceGateError(
        { hdReference: a.hdReference, financeItNumber: a.financeItNumber, financed, programType: a.programType },
        'marking it Funded',
      );
      return {
        id: a.id,
        name: `${a.applicantFirstName} ${a.applicantLastName}`.trim(),
        dealerName: a.dealer.name,
        programType: a.programType,
        status: a.status,
        amount: Number(a.approvedAmount ?? a.requestedAmount) || 0,
        dateOfSale: a.dateOfSale ? a.dateOfSale.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
        hdReference: a.hdReference,
        financeItNumber: a.financeItNumber,
        blockedReason,
      };
    });
}

/**
 * Mark the selected deals Funded (legacy reconciliation). Reuses the same
 * reference gate as the single-deal mark-funded, skipping and reporting any deal
 * that isn't eligible instead of forcing it through. Dealer notifications are
 * deliberately NOT sent — these are old settled deals, not live status changes.
 */
export async function markDealsFundedAction(
  ids: string[],
): Promise<{ funded: number; skipped: { name: string; reason: string }[] }> {
  const session = await requireAdminSection('overview');
  const skipped: { name: string; reason: string }[] = [];
  let funded = 0;
  if (!Array.isArray(ids) || ids.length === 0) return { funded, skipped };
  const unique = Array.from(new Set(ids)).slice(0, 500); // guard against a runaway batch
  for (const id of unique) {
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) { skipped.push({ name: id, reason: 'not found' }); continue; }
    const name = `${app.applicantFirstName} ${app.applicantLastName}`.trim() || id;
    if (app.status === 'FUNDED') { skipped.push({ name, reason: 'already funded' }); continue; }
    const refErr = referenceGateError({ ...app, financed: dealHasFinancing(app) }, 'marking this deal Funded');
    if (refErr) { skipped.push({ name, reason: refErr }); continue; }
    await prisma.$transaction([
      prisma.application.update({ where: { id }, data: { status: 'FUNDED' } }),
      prisma.statusEvent.create({
        data: { applicationId: id, from: app.status, to: 'FUNDED', actorId: session.userId, note: 'Marked Funded — legacy reconciliation' },
      }),
    ]);
    await audit({
      actorId: session.userId,
      action: 'STATUS_CHANGE',
      entityType: 'Application',
      entityId: id,
      detail: `Reconcile: marked Funded (${app.status} -> FUNDED)`,
    });
    await markReviewerAction(id);
    funded += 1;
  }
  revalidatePath('/admin');
  revalidatePath('/admin/reconcile');
  revalidatePath('/staff');
  return { funded, skipped };
}

export interface BackfillUnitsSummary {
  matched: number; // portal deals with a recorded journal row + products
  filled: number; // UNITS cells written (apply) or that would be written (dry run)
  plan: BackfillUnitsPlanRow[];
  skippedHadValue: number;
  skippedMismatch: number;
  skippedNoColumn: number;
  errors: string[];
  applied: boolean;
}

/**
 * One-time back-fill of the journal UNITS column on rows the portal already
 * placed (it recorded the tab + row). The unit count is the number of products
 * on the deal — identical to what the live writer now stamps on every new deal.
 * Only ever fills a BLANK UNITS cell and verifies the row's Last Name first, so
 * it never overwrites a value or the wrong row. `apply: false` is a dry run.
 */
export async function backfillJournalUnitsAction(apply: boolean): Promise<BackfillUnitsSummary> {
  const session = await requireAdminSection('overview');
  const empty: BackfillUnitsSummary = {
    matched: 0, filled: 0, plan: [], skippedHadValue: 0, skippedMismatch: 0, skippedNoColumn: 0, errors: [], applied: false,
  };
  if (!journalEnabled()) {
    return { ...empty, errors: [getT()('actionMsg.staff.journalNotConfiguredBackfill')] };
  }

  // Every deal the portal has placed on the journal (tab + row recorded) that we
  // have a product list for. The unit count is simply the number of products
  // (the journal-name mapping is 1:1, so this matches the live writer exactly).
  const apps = await prisma.application.findMany({
    where: {
      journalTab: { not: null },
      journalRow: { not: null },
      productsSold: { isEmpty: false },
    },
    select: {
      applicantLastName: true,
      productsSold: true,
      journalTab: true,
      journalRow: true,
      dateOfSale: true,
      createdAt: true,
    },
  });

  const deals: BackfillUnitsDeal[] = [];
  for (const a of apps) {
    const units = a.productsSold.filter((p) => p && p.trim()).length;
    if (units <= 0) continue;
    const saleDate = a.dateOfSale ?? a.createdAt;
    deals.push({
      year: saleDate.getUTCFullYear(),
      tab: a.journalTab!,
      row: a.journalRow!,
      units,
      expectLastName: a.applicantLastName,
    });
  }

  const res = await backfillJournalUnits(deals, { apply });

  if (apply && res.filled > 0) {
    await audit({
      actorId: session.userId,
      action: 'JOURNAL_WRITE',
      entityType: 'Journal',
      entityId: 'units-backfill',
      detail: `Back-filled UNITS on ${res.filled} journal row(s)`,
    });
    revalidatePath('/admin');
  }

  return {
    matched: deals.length,
    filled: res.filled,
    plan: res.plan,
    skippedHadValue: res.skippedHadValue,
    skippedMismatch: res.skippedMismatch,
    skippedNoColumn: res.skippedNoColumn,
    errors: res.errors,
    applied: apply,
  };
}

/**
 * Advance ONE stuck deal to In for funding — used by the "Move to In for funding"
 * button on a deal (e.g. the out-of-band banner). Only moves a deal that is
 * genuinely stuck (submitted, or out-of-band Approved/Conditional) and whose
 * uploaded funding documents are all confirmed. Never marks a deal Funded.
 */
export async function advanceDealToInForFundingAction(applicationId: string): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const a = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true, status: true,
      documents: { where: { stage: 'FUNDING' }, select: { type: true, verifiedAt: true } },
      statusEvents: { select: { to: true } },
    },
  });
  if (!a) return { error: t('actionMsg.notFound') };
  const fundingDocs = a.documents;
  const eligible =
    a.status === 'FUNDING_SUBMITTED' ||
    // A DOCS_SENT deal whose signed package came back but never flipped to
    // FUNDING_SUBMITTED (dealer didn't press Submit, or it was added another way).
    a.status === 'DOCS_SENT' ||
    isOutOfBandReturn({ status: a.status, fundingDocTypes: fundingDocs.map((d) => d.type), statusHistoryTos: a.statusEvents.map((e) => e.to) });
  if (!eligible) return { error: t('actionMsg.staff.notStageForFunding') };
  if (fundingDocs.length === 0 || fundingDocs.some((d) => d.verifiedAt === null)) {
    return { error: t('actionMsg.staff.confirmEveryFundingDoc') };
  }
  await moveStuckDealToInForFunding(a.id, a.status, session.userId);
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/admin');
  revalidatePath('/staff');
  return { ok: true };
}

// Reviewer/admin manually sets a deal's status at any time (override/correct).
export async function changeStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const parsed = statusChangeSchema.safeParse({
    applicationId: formData.get('applicationId'),
    status: formData.get('status'),
    note: formData.get('note') || undefined,
  });
  if (!parsed.success) return { error: t('actionMsg.staff.pickValidStatus') };
  const { applicationId, status, note } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };
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
      paymentMethod: app.paymentMethod,
    });
    if (gate) return { error: `${gate} ${t('actionMsg.staff.useApproveForm')}` };
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
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const parsed = noteSchema.safeParse({
    applicationId: formData.get('applicationId'),
    body: formData.get('body'),
    internal: formData.get('internal') === 'true',
  });
  if (!parsed.success) return { error: t('actionMsg.writeNoteFirst') };
  const { applicationId, body, internal } = parsed.data;

  // Hard block: never store payment-card data.
  const card = findCardData(body);
  if (card.blocked) {
    await audit({ actorId: session.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: `Note blocked — card data detected (${card.signals.join(', ')})` });
    return { error: CARD_BLOCK_MESSAGE };
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };

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
  const t = getT();
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
        ? t('actionMsg.staff.couldntSaveCheckField', { label })
        : t('actionMsg.staff.couldntSaveConfirmation'),
    };
  }
  const d = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: d.applicationId } });
  if (!app) return { error: t('actionMsg.staff.applicationNotFound') };

  const allChecked =
    !!d.installedWorking &&
    !!d.performingAsRepresented &&
    !!d.receivedEverything &&
    !!d.termsAgreed &&
    !!d.signatureConfirmed &&
    !!d.notTrialOffer;

  if (d.intent === 'complete' && !allChecked) {
    return { error: t('actionMsg.staff.checkAllSixBoxes') };
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
  const handlingIssue = d.intent === 'issue';
  // Record who HANDLED this confirmation for both outcomes (completed or issue),
  // so the confirmation-team report can attribute each. completedAt stays set
  // only on a clean completion; the deal's confirmationStatus says which it was.
  const stampHandler = completing || handlingIssue;
  await prisma.confirmation.upsert({
    where: { applicationId: d.applicationId },
    create: {
      applicationId: d.applicationId,
      ...fields,
      confirmedById: stampHandler ? session.userId : null,
      completedAt: completing ? new Date() : null,
    },
    update: {
      ...fields,
      ...(stampHandler ? { confirmedById: session.userId } : {}),
      ...(completing ? { completedAt: new Date() } : {}),
    },
  });

  const newStatus =
    d.intent === 'complete' ? 'COMPLETED' : d.intent === 'issue' ? 'ISSUE' : app.confirmationStatus;
  // Completing the confirmation resolves any flagged issue, so clear the deal's
  // issue banner (the Mail itself stays in the office's inbox as history).
  const clearIssue = completing;
  if (newStatus !== app.confirmationStatus || clearIssue) {
    await prisma.application.update({
      where: { id: d.applicationId },
      data: {
        confirmationStatus: newStatus,
        ...(clearIssue ? { confirmationIssueMailId: null } : {}),
      },
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
  const t = getT();
  const session = await requireStaffSection('review-queue');

  const key = String(formData.get('key') || '');
  const status = String(formData.get('status') || '') as VerificationStatus;
  const note = ((formData.get('note') as string) || '').trim();

  const def = VERIFICATION_CHECKS.find((c) => c.key === key);
  if (!def) return { error: t('actionMsg.staff.unknownChecklistItem') };
  if (status !== 'CONFIRMED' && status !== 'PROBLEM' && status !== 'PENDING') {
    return { error: t('actionMsg.staff.invalidStatus') };
  }
  if (status === 'PROBLEM' && !note) {
    return { error: t('actionMsg.staff.addProblemNote') };
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

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


export async function writeToJournalAction(
  applicationId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const res = await syncApplicationToJournal(applicationId, session.userId);
  if (res.status === 'disabled') {
    return {
      error: t('actionMsg.staff.journalNotConnectedDetail'),
    };
  }
  if (res.status === 'error') return { error: t('actionMsg.staff.couldNotWriteJournal', { message: res.message ?? '' }) };
  if (res.status === 'conflict') {
    // Not a failure and not a silent success — the deal is already on the journal.
    // Surface it clearly so staff reconcile it by hand.
    await markReviewerAction(applicationId);
    return { error: `⚠ ${res.message ?? t('actionMsg.staff.alreadyOnJournal')}` };
  }
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true, message: res.message };
}

/**
 * Re-place a deal that is sitting on the wrong journal row (e.g. one the old code
 * appended below the totals row and the portal still "remembers" there). We clear
 * that remembered row's managed cells in the sheet, forget the stored position,
 * and re-write the deal — which lands it on the next blank numbered line. This is
 * the one-click cure for stragglers; brand-new deals already place correctly.
 */
export async function replaceJournalRowAction(
  applicationId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  if (!journalEnabled()) {
    return { error: t('actionMsg.staff.journalNotConnected') };
  }
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

  // Clear the old (misplaced) row's managed cells so re-writing doesn't leave a
  // duplicate and so the duplicate-guard won't re-grab that row by its HD Ref #
  // / Loan #. Best-effort and self-guarding (it refuses if the row's Last Name
  // no longer matches), so a stale remembered row never blocks the re-place.
  if (app.journalTab && app.journalRow) {
    try {
      const year = (app.dateOfSale ?? app.createdAt).getUTCFullYear();
      await clearJournalRow(year, app.journalTab, app.journalRow, app.applicantLastName);
    } catch (err) {
      console.error('[journal] clear old row failed (continuing)', err);
    }
  }

  // Forget the remembered position so the deal is re-placed as if brand new.
  await prisma.application.update({
    where: { id: applicationId },
    data: { journalTab: null, journalRow: null, journalSyncedAt: null },
  });

  const res = await syncApplicationToJournal(applicationId, session.userId);
  if (res.status === 'disabled') return { error: t('actionMsg.staff.journalNotConnected') };
  if (res.status === 'error') return { error: t('actionMsg.staff.couldNotReplaceDeal', { message: res.message ?? '' }) };
  if (res.status === 'conflict') {
    await markReviewerAction(applicationId);
    return { error: `⚠ ${res.message ?? t('actionMsg.staff.alreadyOnJournal')}` };
  }
  await markReviewerAction(applicationId);
  revalidatePath(`/staff/applications/${applicationId}`);
  const movedBase = t('actionMsg.staff.movedToNextLine');
  return { ok: true, message: res.message ? `${movedBase} ${res.message}` : movedBase };
}

// --- Customer review request (confirmation step) ---------------------------

function portalUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://portal.ghsbarrie.ca').replace(/\/$/, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Add/correct the customer's email on a deal, so the review request (and other
 * customer email) can go out. Reviewer/admin only.
 */
export async function setCustomerEmailAction(
  applicationId: string,
  email: string,
): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const e = (email || '').trim();
  if (!EMAIL_RE.test(e) || e.length > 160) return { error: t('actionMsg.staff.enterValidEmail') };
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };
  await prisma.application.update({ where: { id: applicationId }, data: { applicantEmail: e } });
  await audit({
    actorId: session.userId,
    action: 'APPLICATION_UPDATE',
    entityType: 'Application',
    entityId: applicationId,
    detail: 'Added/updated customer email',
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Add/correct the customer's phone on a deal, so the review request can be
 * texted (and so a malformed number gets fixed). Validates it's a real number
 * and stores a tidy format. Reviewer/admin only.
 */
export async function setCustomerPhoneAction(
  applicationId: string,
  phone: string,
): Promise<ActionState> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const e164 = toE164(phone);
  if (!e164) return { error: t('actionMsg.staff.enterValidMobile') };
  // Store NANP numbers as XXX-XXX-XXXX (the portal's phone convention); keep a
  // non-NANP international number in E.164.
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  const stored = m ? `${m[1]}-${m[2]}-${m[3]}` : e164;
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };
  await prisma.application.update({ where: { id: applicationId }, data: { applicantPhone: stored } });
  await audit({
    actorId: session.userId,
    action: 'APPLICATION_UPDATE',
    entityType: 'Application',
    entityId: applicationId,
    detail: 'Added/updated customer phone',
  });
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true };
}

/**
 * Set the global customer-review link (e.g. a Google-review landing page).
 * Admin only. Passing an empty string clears it.
 */
export async function setReviewLinkAction(link: string): Promise<ActionState> {
  const t = getT();
  await requireAdminSection('overview');
  const v = (link || '').trim();
  if (v && !/^https?:\/\/\S+$/i.test(v)) return { error: t('actionMsg.staff.enterFullLink') };
  await setSetting(REVIEW_SETTING_KEYS.link, v);
  revalidatePath('/staff/applications', 'layout');
  return { ok: true };
}

/**
 * Send the customer a "leave us a review" request by email and/or text. Sends
 * only on the channels asked for and available (email needs an address on file;
 * SMS needs a provider configured). Records the send for display. Reviewer/admin.
 */
export async function sendReviewRequestAction(
  applicationId: string,
  channels: { email?: boolean; sms?: boolean },
): Promise<ActionState & { sentEmail?: boolean; sentSms?: boolean; note?: string }> {
  const t = getT();
  const session = await requireStaffSection('review-queue');

  const link = await getReviewLink();
  if (!link) return { error: t('actionMsg.staff.noReviewLink') };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true, applicantFirstName: true, applicantLastName: true, applicantEmail: true, applicantPhone: true,
      salespersonName: true, productsSold: true,
    },
  });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

  const name = `${app.applicantFirstName} ${app.applicantLastName}`.trim();
  const wantEmail = channels.email !== false; // default to email
  const wantSms = channels.sms === true;

  let sentEmail = false;
  let sentSms = false;
  const problems: string[] = [];

  if (wantEmail) {
    const to = (app.applicantEmail || '').trim();
    if (!to || !EMAIL_RE.test(to)) {
      problems.push(t('actionMsg.staff.probNoEmail'));
    } else if (!emailEnabled()) {
      problems.push(t('actionMsg.staff.probEmailOff'));
    } else {
      const { subject, html, text } = buildReviewEmail({
        customerName: name,
        reviewLink: link,
        logoUrl: `${portalUrl()}/gwa-hd-partners.png`,
        products: app.productsSold,
        repName: app.salespersonName ?? '',
      });
      // Review requests come from (and reply to) Reporter@ghsbarrie.ca, separate
      // from the general hello@/info@ identity. The SMTP account must be allowed
      // to send as this address or the provider may rewrite the From.
      const r = await sendEmail({
        to, subject, html, text,
        from: 'Georgian Water & Air <Reporter@ghsbarrie.ca>',
        replyTo: 'Reporter@ghsbarrie.ca',
      });
      if (r.sent) sentEmail = true;
      else problems.push(t('actionMsg.staff.probEmailFailed', { reason: r.reason ?? t('actionMsg.staff.errorGeneric') }));
    }
  }

  if (wantSms) {
    if (!smsEnabled()) {
      problems.push(t('actionMsg.staff.probSmsOff'));
    } else {
      const body = buildReviewSms({ customerName: name, reviewLink: link });
      const r = await sendSms({ to: app.applicantPhone, body });
      if (r.sent) sentSms = true;
      else problems.push(t('actionMsg.staff.probSmsFailed', { reason: r.reason ?? t('actionMsg.staff.errorGeneric') }));
    }
  }

  if (!sentEmail && !sentSms) {
    return { error: t('actionMsg.staff.couldntSendReview', { detail: problems.join('; ') || t('actionMsg.staff.nothingToSend') }) };
  }

  const via = [sentEmail && 'email', sentSms && 'sms'].filter(Boolean).join('+');
  await prisma.application.update({
    where: { id: applicationId },
    data: { reviewRequestSentAt: new Date(), reviewRequestVia: via, reviewRequestByName: session.name, reviewRequestById: session.userId },
  });
  await audit({
    actorId: session.userId,
    action: 'MAIL_SEND',
    entityType: 'Application',
    entityId: applicationId,
    detail: `Review request sent (${via})`,
  });
  revalidatePath(`/staff/applications/${applicationId}`);

  const note = problems.length ? t('actionMsg.staff.sentButProblems', { problems: problems.join('; ') }) : undefined;
  return { ok: true, sentEmail, sentSms, note };
}

/**
 * Send a TEST of the review email to the signed-in staffer's own inbox, so they
 * can confirm the real thing (logo, From Reporter@, layout) renders and delivers.
 * Uses the configured review link (or a placeholder if none is set yet) and
 * sample product/rep values so the copy lines show.
 */
export async function sendReviewTestAction(): Promise<ActionState & { sentTo?: string; note?: string }> {
  const t = getT();
  const session = await requireRole('REVIEWER', 'ADMIN');
  if (!emailEnabled()) return { error: t('actionMsg.staff.emailOffTest') };
  const to = (session.email || '').trim();
  if (!to || !EMAIL_RE.test(to)) return { error: t('actionMsg.staff.noAccountEmail') };

  const configuredLink = await getReviewLink();
  const link = configuredLink || `https://georgianwaterandair.ca`;
  const { subject, html, text } = buildReviewEmail({
    customerName: session.name || 'there',
    reviewLink: link,
    logoUrl: `${portalUrl()}/gwa-hd-partners.png`,
    products: ['Reverse Osmosis Drinking Water System', 'Water Softener'],
    repName: 'Mark',
  });
  const r = await sendEmail({
    to, subject, html, text,
    from: 'Georgian Water & Air <Reporter@ghsbarrie.ca>',
    replyTo: 'Reporter@ghsbarrie.ca',
  });
  if (!r.sent) return { error: t('actionMsg.staff.testFailed', { reason: r.reason ?? t('actionMsg.staff.errorGeneric') }) };

  await audit({ actorId: session.userId, action: 'MAIL_SEND', entityType: 'User', entityId: session.userId, detail: 'Review email test sent' });
  const note = configuredLink
    ? undefined
    : t('actionMsg.staff.testNoLinkNote');
  return { ok: true, sentTo: to, note };
}

/**
 * Email one or more stored library documents (brochures / manuals) to the
 * customer — e.g. when they ask for one on the confirmation call. Files are
 * decrypted and attached (capped so the email stays deliverable); a record is
 * written to the deal (customer file) and audited. Reviewer/admin only.
 */
export async function emailDocumentsToCustomerAction(
  applicationId: string,
  contentItemIds: string[],
  message: string,
  toOverride?: string,
): Promise<ActionState & { sentTo?: string }> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  if (!emailEnabled()) return { error: t('actionMsg.staff.emailOff') };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, applicantFirstName: true, applicantLastName: true, applicantEmail: true },
  });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

  const to = (toOverride?.trim() || app.applicantEmail || '').trim();
  if (!to || !EMAIL_RE.test(to)) return { error: t('actionMsg.staff.enterValidCustomerEmailSend') };

  const ids = Array.from(new Set((contentItemIds || []).filter(Boolean))).slice(0, 10);
  if (ids.length === 0) return { error: t('actionMsg.staff.pickOneDocument') };

  // The Product Library files (manuals / brochures / spec sheets).
  const items = await prisma.resourceProductFile.findMany({
    where: { id: { in: ids }, product: { active: true } },
    select: { id: true, storageKey: true, mime: true, originalName: true, label: true, kind: true, product: { select: { title: true } } },
  });
  if (items.length === 0) return { error: t('actionMsg.staff.docsNotAvailable') };

  const titleOf = (it: (typeof items)[number]) => `${it.product.title}${it.label ? ` (${it.label})` : ''}`;
  const cleanName = (s: string) => (s || 'document').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Attach what fits and keeps the email deliverable (providers cap the whole
  // message near 25 MB, and base64 inflates attachments ~37%, so we hold the raw
  // attachment budget at 20 MB). Anything that would blow the budget — or a
  // single oversized manual — is sent as a secure, 30-day download link instead,
  // so big files still reach the customer rather than erroring out.
  const ATTACH_BUDGET = 20 * 1024 * 1024;
  let attachedBytes = 0;
  const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
  const attachedTitles: string[] = [];
  const links: { title: string; url: string }[] = [];
  for (const it of items) {
    let buf: Buffer;
    try {
      buf = await getDocument(it.storageKey);
    } catch {
      return { error: t('actionMsg.staff.couldntReadDoc', { title: titleOf(it) }) };
    }
    if (buf.length <= ATTACH_BUDGET && attachedBytes + buf.length <= ATTACH_BUDGET) {
      attachedBytes += buf.length;
      attachments.push({
        filename: it.originalName || `${cleanName(it.product.title)}.pdf`,
        content: buf,
        contentType: it.mime || 'application/octet-stream',
      });
      attachedTitles.push(titleOf(it));
    } else {
      links.push({ title: titleOf(it), url: `${portalUrl()}/d/${makeDocLinkToken(it.id)}` });
    }
  }

  const name = `${app.applicantFirstName} ${app.applicantLastName}`.trim();
  const { subject, html, text } = buildDocsEmail({
    customerName: name,
    message: message || '',
    attachedTitles,
    links,
    linkTtlDays: DOC_LINK_TTL_DAYS,
    logoUrl: `${portalUrl()}/gwa-hd-partners.png`,
  });
  const r = await sendEmail({ to, subject, html, text, attachments });
  if (!r.sent) return { error: t('actionMsg.staff.didntSend', { reason: r.reason ?? t('actionMsg.staff.errorGeneric') }) };

  // Record on the customer file (internal note) + audit.
  const linkNote = links.length ? ` (${links.length} sent as ${DOC_LINK_TTL_DAYS}-day download link${links.length === 1 ? '' : 's'})` : '';
  await prisma.note.create({
    data: { applicationId, authorId: session.userId, internal: true, body: `📎 Emailed to customer (${to}): ${items.map(titleOf).join(', ')}${linkNote}` },
  });
  await audit({ actorId: session.userId, action: 'MAIL_SEND', entityType: 'Application', entityId: applicationId, detail: `Emailed documents to customer: ${items.map(titleOf).join(', ')}` });
  revalidatePath(`/staff/applications/${applicationId}`);
  return { ok: true, sentTo: to };
}

/**
 * Flag an issue to the dealer from the confirmation step: when a confirmer finds
 * the customer has a question or concern, this posts a dealer-visible note on the
 * deal (so it lives in the portal, on the customer's file, and the dealer can
 * reply), marks the confirmation as an ISSUE, and notifies the office's users by
 * email + push via the normal note plumbing. The dealer's reply comes back to
 * staff the same way, so the whole back-and-forth is tracked in the portal.
 */
export async function flagDealerIssueAction(
  applicationId: string,
  body: string,
): Promise<ActionState & { notified?: number }> {
  const t = getT();
  const session = await requireStaffSection('review-queue');
  const text = (body || '').trim();
  if (text.length < 3) return { error: t('actionMsg.staff.describeIssue') };
  if (text.length > 4000) return { error: t('actionMsg.staff.issueTooLong') };

  // Never store payment-card data (same guard as a normal note).
  const card = findCardData(text);
  if (card.blocked) {
    await audit({ actorId: session.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: `Issue note blocked — card data detected (${card.signals.join(', ')})` });
    return { error: CARD_BLOCK_MESSAGE };
  }

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, dealerId: true, applicantFirstName: true, applicantLastName: true },
  });
  if (!app) return { error: t('actionMsg.staff.dealNotFound') };

  // 1) Post the issue into the DEAL CHAT — it shows on BOTH the staff and dealer
  // copies of the deal (the "Chat with the dealer" thread), is saved to the
  // customer file, and the dealer can reply right there. (A one-way dealer note
  // isn't shown on the staff side, which is why a flagged issue seemed to vanish.)
  const conv = await getOrCreateDealConversation(applicationId, session);
  if (!conv) return { error: t('actionMsg.staff.couldntOpenConversation') };
  await postChatMessage({ conversationId: conv.id, user: session, body: `⚠ Issue to review (confirmation call):\n\n${text}` });

  // 2) Send a portal Mail to the office that REQUIRES them to acknowledge they've
  // read it. It lands in /dealer/mail with an "Ack required" badge and forces the
  // "I have read this" button; staff can see who acknowledged at /staff/mail/<id>.
  // The subject carries the "action needed" framing, so the body is just the
  // confirmer's words (which the deal banner also shows).
  // Full customer name so the dealer immediately knows WHICH customer has the
  // issue (the deal is their own customer, so no masking is needed here).
  const first = (app.applicantFirstName || '').trim();
  const last = (app.applicantLastName || '').trim();
  const dealName = `${first}${last ? ` ${last}` : ''}`.trim() || 'a deal';
  const mail = await prisma.mail.create({
    data: {
      subject: `Action needed: confirmation issue — ${dealName}`,
      body: text,
      requireAck: true,
      allowReplies: false,
      distributorsOnly: false,
      allDealers: false,
      senderId: session.userId,
      // Link the deal so the dealer can open that exact customer's profile
      // straight from the message (an "Open deal" button in the mail).
      applicationId: app.id,
      recipients: { create: [{ dealerId: app.dealerId }] },
    },
  });

  // Mark the confirmation as an issue (a soft flag — does not move the deal) and
  // remember the mail so the deal page can show a top banner with its ack state.
  await prisma.application.update({
    where: { id: applicationId },
    data: { confirmationStatus: 'ISSUE', confirmationIssueMailId: mail.id },
  });

  // 3) Email + push every active user at the office. This is action-required, so
  // it overrides the routine "new notes" preference. Returns how many were sent.
  const notified = await notifyConfirmationIssue(applicationId, mail.id);

  await markReviewerAction(applicationId);
  await audit({ actorId: session.userId, action: 'MAIL_SEND', entityType: 'Mail', entityId: mail.id, detail: `Confirmation issue flagged to dealer ${app.dealerId}, acknowledgement required` });
  await audit({ actorId: session.userId, action: 'DECISION', entityType: 'Application', entityId: applicationId, detail: 'Issue flagged to dealer (confirmation)' });
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/staff/mail');
  return { ok: true, notified };
}

// --- Morning catch-up digest --------------------------------------------------

/**
 * "Mark caught up" on the reviewer digest. Stamps the user's catchUpSeenAt to
 * now, so the next digest only shows what's happened since. Reviewer/admin only.
 */
export async function markCaughtUpAction(): Promise<void> {
  const session = await requireRole('REVIEWER', 'ADMIN');
  await prisma.user.update({ where: { id: session.userId }, data: { catchUpSeenAt: new Date() } });
  revalidatePath('/staff');
}
