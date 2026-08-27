'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { audit } from '@/lib/audit';
import { notifyGiftCardNote } from '@/lib/notify';

export interface GiftCardActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Clean an optional phone; returns '' when blank, or null when clearly invalid. */
function cleanPhone(raw: string): string | null {
  const t = raw.trim();
  if (!t) return '';
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return t;
}

/**
 * A dealer requests a Home Depot gift card for a customer who completed a water
 * test. Goes into the PENDING queue GWA sends from Guusto.
 */
export async function createGiftCardRequestAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'Your login is not attached to a dealer.' };

  const customerName = String(formData.get('customerName') || '').replace(/\s+/g, ' ').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim().toLowerCase();
  const customerPhone = cleanPhone(String(formData.get('customerPhone') || ''));
  const amountRaw = String(formData.get('amount') || '').replace(/[$,\s]/g, '');
  const amount = Number(amountRaw);

  if (!customerName) return { error: 'Enter the customer’s name.' };
  if (!EMAIL_RE.test(customerEmail)) return { error: 'Enter a valid customer email address.' };
  if (customerPhone === null) return { error: 'Enter a valid cell number (at least 10 digits) or leave it blank.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return { error: 'Enter a card amount between $1 and $1,000.' };

  const gc = await prisma.giftCardRequest.create({
    data: {
      dealerId: session.dealerId,
      requestedById: session.userId,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      amount,
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: gc.id, detail: `Gift-card request: ${customerName} <${customerEmail}> $${amount}` });
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: 'Gift-card request submitted.' };
}

/**
 * A dealer corrects a request's contact details (e.g. the customer called to say
 * they never got the card because the email was wrong, or wants it by text). Kept
 * available even after it was sent, so a bad email can be fixed and re-sent. Flags
 * it for staff and drops an automatic note so they see what changed.
 */
export async function editGiftCardRequestAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const session = await requireDealerAccess();
  const id = String(formData.get('requestId') || '');
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc || gc.dealerId !== session.dealerId) return { error: 'Request not found.' };
  if (gc.status === 'CANCELLED') return { error: 'This request was cancelled.' };

  const customerName = String(formData.get('customerName') || '').replace(/\s+/g, ' ').trim();
  const customerEmail = String(formData.get('customerEmail') || '').trim().toLowerCase();
  const customerPhone = cleanPhone(String(formData.get('customerPhone') || ''));
  if (!customerName) return { error: 'Enter the customer’s name.' };
  if (!EMAIL_RE.test(customerEmail)) return { error: 'Enter a valid customer email address.' };
  if (customerPhone === null) return { error: 'Enter a valid cell number (at least 10 digits) or leave it blank.' };

  const changes: string[] = [];
  if (customerName !== gc.customerName) changes.push(`name → ${customerName}`);
  if (customerEmail !== gc.customerEmail) changes.push(`email → ${customerEmail}`);
  if ((customerPhone || null) !== (gc.customerPhone ?? null)) changes.push(`cell → ${customerPhone || '(none)'}`);
  if (changes.length === 0) return { ok: true, message: 'No changes.' };

  await prisma.giftCardRequest.update({
    where: { id },
    data: {
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      staffUnread: true,
      notes: { create: { authorId: session.userId, fromDealer: true, body: `Updated contact info: ${changes.join(', ')}.` } },
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: id, detail: `Gift-card contact edited: ${changes.join(', ')}` });
  void notifyGiftCardNote(id, true);
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: 'Details updated — the team has been notified.' };
}

/** A dealer adds a note to the request's thread (visible to staff). */
export async function addGiftCardNoteAction(
  _prev: GiftCardActionState,
  formData: FormData,
): Promise<GiftCardActionState> {
  const session = await requireDealerAccess();
  const id = String(formData.get('requestId') || '');
  const body = String(formData.get('body') || '').trim();
  if (!body) return { error: 'Enter a message.' };
  if (body.length > 2000) return { error: 'Message is too long.' };
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc || gc.dealerId !== session.dealerId) return { error: 'Request not found.' };

  await prisma.giftCardRequest.update({
    where: { id },
    data: { staffUnread: true, notes: { create: { authorId: session.userId, fromDealer: true, body } } },
  });
  void notifyGiftCardNote(id, true);
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: 'Message sent.' };
}

/** A dealer cancels their own still-pending request (typo, duplicate, etc.). */
export async function cancelGiftCardRequestAction(id: string): Promise<void> {
  const session = await requireDealerAccess();
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  // Only the owning dealer, and only while still pending.
  if (!gc || gc.dealerId !== session.dealerId || gc.status !== 'PENDING') return;
  await prisma.giftCardRequest.update({ where: { id }, data: { status: 'CANCELLED' } });
  revalidatePath('/dealer/gift-cards');
}
