'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireDealerAccess } from '@/lib/session';
import { audit } from '@/lib/audit';

export interface GiftCardActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
  const amountRaw = String(formData.get('amount') || '').replace(/[$,\s]/g, '');
  const amount = Number(amountRaw);

  if (!customerName) return { error: 'Enter the customer’s name.' };
  if (!EMAIL_RE.test(customerEmail)) return { error: 'Enter a valid customer email address.' };
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) return { error: 'Enter a card amount between $1 and $1,000.' };

  const gc = await prisma.giftCardRequest.create({
    data: {
      dealerId: session.dealerId,
      requestedById: session.userId,
      customerName,
      customerEmail,
      amount,
    },
  });
  await audit({ actorId: session.userId, action: 'ORDER_SUBMIT', entityType: 'GiftCardRequest', entityId: gc.id, detail: `Gift-card request: ${customerName} <${customerEmail}> $${amount}` });
  revalidatePath('/dealer/gift-cards');
  return { ok: true, message: 'Gift-card request submitted.' };
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
