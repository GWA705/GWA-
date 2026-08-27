'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireGiftCardAccess } from '@/lib/giftCardAccess';
import { audit } from '@/lib/audit';

export interface GiftCardAdminState {
  error?: string;
  ok?: boolean;
  message?: string;
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
  await prisma.giftCardRequest.update({ where: { id }, data: { status: 'PENDING', sentAt: null, sentById: null } });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: id, detail: 'Reverted gift card to pending' });
  revalidatePath('/admin/gift-cards');
  revalidatePath('/staff/gift-cards');
  revalidatePath('/dealer/gift-cards');
}
