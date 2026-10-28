'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireStaffSection } from '@/lib/session';
import { audit } from '@/lib/audit';

export interface GiftCardConfirmActionResult {
  ok?: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function revalidateDeal(applicationId: string) {
  revalidatePath(`/staff/applications/${applicationId}`);
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
}

/**
 * Record (or clear) that the customer confirmed on the confirmation call that
 * they received their gift card. Only a card that was actually sent can be
 * marked received.
 */
export async function markGiftCardReceivedAction(
  requestId: string,
  received: boolean,
  applicationId: string,
): Promise<GiftCardConfirmActionResult> {
  const session = await requireStaffSection('review-queue');
  const gc = await prisma.giftCardRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, customerName: true },
  });
  if (!gc) return { error: 'Gift-card request not found.' };
  if (gc.status !== 'SENT') return { error: 'That card has not been sent yet, so it cannot be marked received.' };

  await prisma.giftCardRequest.update({
    where: { id: requestId },
    data: received
      ? { receivedAt: new Date(), receivedById: session.userId }
      : { receivedAt: null, receivedById: null },
  });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'GiftCardRequest',
    entityId: requestId,
    detail: `Confirmation call: customer ${received ? 'confirmed received' : 'marked NOT received'} — ${gc.customerName}`,
  });
  revalidateDeal(applicationId);
  return { ok: true };
}

/**
 * Flag an already-requested (but not yet sent) card as urgent, so the gift-card
 * team sends it first. Surfaces it to staff (staffUnread) and stamps a note.
 */
export async function flagGiftCardUrgentAction(
  requestId: string,
  applicationId: string,
): Promise<GiftCardConfirmActionResult> {
  const session = await requireStaffSection('review-queue');
  const gc = await prisma.giftCardRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, customerName: true },
  });
  if (!gc) return { error: 'Gift-card request not found.' };
  if (gc.status !== 'PENDING') return { error: 'Only a card still waiting to be sent can be flagged urgent.' };

  await prisma.giftCardRequest.update({
    where: { id: requestId },
    data: {
      important: true,
      staffUnread: true,
      notes: { create: { authorId: session.userId, fromDealer: false, body: 'Flagged urgent from a confirmation call — please send ASAP.' } },
    },
  });
  await audit({
    actorId: session.userId,
    action: 'STATUS_CHANGE',
    entityType: 'GiftCardRequest',
    entityId: requestId,
    detail: `Confirmation call: flagged gift card urgent — ${gc.customerName}`,
  });
  revalidateDeal(applicationId);
  return { ok: true };
}

/**
 * Create a new gift-card request straight from the confirmation call — either a
 * resend (the customer never got the first one) or a brand-new card when none
 * is on record. Always flagged Important so the gift-card team sends it first.
 */
export async function sendGiftCardFromConfirmationAction(input: {
  applicationId: string;
  email: string;
  amount: number;
  note?: string;
}): Promise<GiftCardConfirmActionResult> {
  const session = await requireStaffSection('review-queue');

  const email = String(input.email || '').trim().toLowerCase();
  const amount = Number(input.amount);
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address for the customer.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return { error: 'Enter a card amount between $1 and $1000.' };

  const app = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { id: true, dealerId: true, applicantFirstName: true, applicantLastName: true },
  });
  if (!app) return { error: 'Deal not found.' };

  const customerName = `${app.applicantFirstName} ${app.applicantLastName}`.replace(/\s+/g, ' ').trim();
  const extra = String(input.note || '').replace(/\s+/g, ' ').trim();
  const note = `Requested from confirmation call${extra ? ` — ${extra}` : ''}`;

  const gc = await prisma.giftCardRequest.create({
    data: {
      dealerId: app.dealerId,
      requestedById: session.userId,
      customerName,
      customerEmail: email,
      amount,
      important: true,
      staffUnread: true,
      note,
    },
    select: { id: true },
  });
  await audit({
    actorId: session.userId,
    action: 'ORDER_SUBMIT',
    entityType: 'GiftCardRequest',
    entityId: gc.id,
    detail: `Confirmation call: gift-card request (Important) — ${customerName} <${email}> $${amount}`,
  });
  revalidateDeal(input.applicationId);
  return { ok: true };
}
