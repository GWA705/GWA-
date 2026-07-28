'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { audit } from '@/lib/audit';
import { storeFiles } from '@/lib/upload';
import { decisionSchema, payoutSchema } from '@/lib/validation';
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
  });
  if (!parsed.success) return { error: 'Invalid decision.' };
  const { applicationId, type, notes } = parsed.data;

  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return { error: 'Application not found.' };

  if (!isTransitionAllowed(app.status, type)) {
    return { error: `Cannot ${type.replace('_', ' ').toLowerCase()} an application in status ${app.status}.` };
  }

  const to = nextStatus(type);

  await prisma.$transaction(async (tx) => {
    await tx.decision.create({
      data: { applicationId, type, notes: notes || null, decidedById: session.userId },
    });
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
