'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireGiftCardAccess } from '@/lib/giftCardAccess';
import { audit } from '@/lib/audit';
import { notifyGiftCardNote } from '@/lib/notify';

export interface GiftCardAdminState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** Staff reply into a request's note thread (visible to the dealer). */
export async function addStaffGiftCardNoteAction(_prev: GiftCardAdminState, formData: FormData): Promise<GiftCardAdminState> {
  const session = await requireGiftCardAccess();
  const id = String(formData.get('requestId') || '');
  const body = String(formData.get('body') || '').trim();
  if (!body) return { error: 'Enter a message.' };
  if (body.length > 2000) return { error: 'Message is too long.' };
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc) return { error: 'Request not found.' };

  await prisma.giftCardRequest.update({
    where: { id },
    // Staff replying is also staff having reviewed it → clear the staff-unread flag.
    data: { dealerUnread: true, staffUnread: false, notes: { create: { authorId: session.userId, fromDealer: false, body } } },
  });
  void notifyGiftCardNote(id, false);
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: 'Reply sent to the dealer.' };
}

/**
 * Mark one request as reviewed — clears the staff-unread flag without replying.
 * Lets staff clear a note on an already-sent card (so it leaves "Needs
 * attention") once they've read it, even when no reply is needed.
 */
export async function markGiftCardReviewedAction(id: string): Promise<void> {
  await requireGiftCardAccess(); // access enforced; throws if not allowed
  if (!id) return;
  const gc = await prisma.giftCardRequest.findUnique({ where: { id }, select: { id: true, staffUnread: true } });
  if (!gc || !gc.staffUnread) return;
  await prisma.giftCardRequest.update({ where: { id }, data: { staffUnread: false } });
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
}

/**
 * Mark one or more gift-card requests as SENT (after they've been issued in
 * Guusto). Stamps sentAt + who sent it, which becomes the dealer's receipt.
 */
export async function markGiftCardsSentAction(_prev: GiftCardAdminState, formData: FormData): Promise<GiftCardAdminState> {
  const session = await requireGiftCardAccess();
  const ids = formData.getAll('ids').map(String).filter(Boolean);
  if (ids.length === 0) return { error: 'Select at least one to mark sent.' };

  const now = new Date();
  const res = await prisma.giftCardRequest.updateMany({
    where: { id: { in: ids }, status: 'PENDING' },
    data: { status: 'SENT', sentAt: now, sentById: session.userId },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: 'bulk', detail: `Marked ${res.count} gift card(s) sent` });
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: `Marked ${res.count} sent.` };
}

/** Reverse an accidental "sent" back to pending. */
export async function unsendGiftCardAction(id: string): Promise<void> {
  const session = await requireGiftCardAccess();
  const gc = await prisma.giftCardRequest.findUnique({ where: { id } });
  if (!gc || gc.status !== 'SENT') return;
  await prisma.giftCardRequest.update({
    where: { id },
    data: {
      status: 'PENDING',
      sentAt: null,
      sentById: null,
      dealerUnread: true,
      notes: { create: { authorId: session.userId, fromDealer: false, body: 'Reopened to re-send this card.' } },
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: id, detail: 'Reverted gift card to pending' });
  void notifyGiftCardNote(id, false);
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
  revalidatePath('/dealer/gift-cards');
}
