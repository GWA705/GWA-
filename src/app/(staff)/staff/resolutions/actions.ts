'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { notifyNewNote } from '@/lib/notify';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { nextCaseNumber } from '@/lib/resolutionCases';
import { isResolutionStatus, STATUS_LABEL, OPEN_STATUSES, PRIORITIES } from '@/lib/resolutionStatus';
import { normalizeCallPhone } from '@/lib/customerCalls';
import type { ResolutionStatus, Prisma } from '@prisma/client';

export interface CaseFormState {
  error?: string;
  ok?: boolean;
}

/** Open a new HD resolution case. Optionally prefilled from a deal (applicationId). */
export async function createCaseAction(_prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');

  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const rawPriority = String(formData.get('priority') || 'normal');
  const priority = (PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority : 'normal';
  const applicationId = String(formData.get('applicationId') || '').trim() || null;
  if (title.length < 2) return { error: 'Give the case a short title.' };
  if (description.length < 2) return { error: 'Describe the problem.' };

  let customerName = String(formData.get('customerName') || '').trim();
  let customerPhone = String(formData.get('customerPhone') || '').trim();
  let hdReference = String(formData.get('hdReference') || '').trim() || null;
  let officeDealerId: string | null = null;

  if (applicationId) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { applicantFirstName: true, applicantLastName: true, applicantPhone: true, hdReference: true, dealerId: true },
    });
    if (!app) return { error: 'Linked deal not found.' };
    customerName = `${app.applicantFirstName} ${app.applicantLastName}`.trim();
    customerPhone = app.applicantPhone ?? '';
    hdReference = hdReference || app.hdReference || null;
    officeDealerId = app.dealerId;
  }
  if (!customerName) return { error: 'Enter the customer name (or link a deal).' };

  const caseNumber = await nextCaseNumber();
  const created = await prisma.resolutionCase.create({
    data: {
      caseNumber, title, description, priority, applicationId,
      customerName, customerPhone: normalizeCallPhone(customerPhone),
      officeDealerId, hdReference, openedById: user.userId,
    },
  });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: created.id, detail: `Opened HD resolution case ${caseNumber}` });
  revalidatePath('/staff/resolutions');
  redirect(`/staff/resolutions/${created.id}`);
}

/** Add a plain note to a case's activity thread. */
export async function addCaseNoteAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const body = String(formData.get('body') || '').trim();
  if (body.length < 1) return { error: 'Write a note.' };
  if (body.length > 4000) return { error: 'Note is too long.' };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return { error: 'Case not found.' };
  await prisma.resolutionCaseNote.create({ data: { caseId, authorId: user.userId, body } });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}

/** Move a case to a new status; records the transition on the activity thread. */
export async function updateCaseStatusAction(caseId: string, status: string): Promise<void> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!isResolutionStatus(status)) return;
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, status: true } });
  if (!c || c.status === status) return;

  const data: Prisma.ResolutionCaseUpdateInput = { status: status as ResolutionStatus };
  if (status === 'RESOLVED') data.resolvedAt = new Date();
  else if (OPEN_STATUSES.includes(status as ResolutionStatus)) data.resolvedAt = null;
  // CLOSED: leave resolvedAt as-is.

  await prisma.$transaction([
    prisma.resolutionCase.update({ where: { id: caseId }, data }),
    prisma.resolutionCaseNote.create({
      data: {
        caseId, authorId: user.userId,
        body: `Status changed to ${STATUS_LABEL[status as ResolutionStatus]}.`,
        statusFrom: c.status, statusTo: status as ResolutionStatus,
      },
    }),
  ]);
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: `${c.status} → ${status}` });
  revalidatePath(`/staff/resolutions/${caseId}`);
  revalidatePath('/staff/resolutions');
}

/** Assign (or unassign with '') a case to an internal staff member. */
export async function assignCaseAction(caseId: string, assignedToId: string): Promise<void> {
  await requireRole('REVIEWER', 'ADMIN');
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return;
  const id = assignedToId || null;
  if (id) {
    const u = await prisma.user.findFirst({ where: { id, role: { in: ['REVIEWER', 'ADMIN'] }, active: true }, select: { id: true } });
    if (!u) return;
  }
  await prisma.resolutionCase.update({ where: { id: caseId }, data: { assignedToId: id } });
  revalidatePath(`/staff/resolutions/${caseId}`);
}

/**
 * Notify the office that owns the customer (one-way). Reuses the proven
 * dealer-visible-note + notification path, so the case must be linked to a deal
 * (that's how we reach the office).
 */
export async function notifyOfficeAction(caseId: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  const message = String(formData.get('message') || '').trim();
  if (message.length < 2) return { error: 'Write a message for the office.' };
  const c = await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, caseNumber: true, applicationId: true } });
  if (!c) return { error: 'Case not found.' };
  if (!c.applicationId) return { error: 'Link this case to the customer’s deal first, so we can reach their office.' };

  const card = findCardData(message);
  if (card.blocked) {
    await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'ResolutionCase', entityId: caseId, detail: 'office notify blocked — card data detected' });
    return { error: CARD_BLOCK_MESSAGE };
  }

  await prisma.note.create({ data: { applicationId: c.applicationId, authorId: user.userId, body: `🧰 HD Resolution (${c.caseNumber}) — ${message}`, internal: false } });
  await notifyNewNote(c.applicationId, 'REVIEWER');
  await prisma.resolutionCaseNote.create({ data: { caseId, authorId: user.userId, body: `Notified the office: ${message}` } });
  await audit({ actorId: user.userId, action: 'STATUS_CHANGE', entityType: 'ResolutionCase', entityId: caseId, detail: 'notified office' });
  revalidatePath(`/staff/resolutions/${caseId}`);
  return { ok: true };
}
