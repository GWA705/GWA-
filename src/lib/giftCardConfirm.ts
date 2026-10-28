import { prisma } from '@/lib/db';

// Summary of the gift-card record that matches a deal's customer, shown on the
// confirmation call screen so the confirmer can verify the customer actually
// got their Home Depot gift card (and resend/request one if not).
export interface GiftCardConfirmSummary {
  id: string;
  status: 'PENDING' | 'SENT';
  amount: number; // dollars
  email: string; // the email on the matching record
  sentAt: string | null; // ISO
  sentByName: string | null;
  receivedAt: string | null; // ISO — set when a confirmer verified receipt on a call
  important: boolean;
}

/**
 * Find the gift-card record for a deal's customer, matched on the email we have
 * on file (case-insensitive). Returns the most recent live request (PENDING or
 * SENT); a cancelled-only or missing history returns null, which the UI treats
 * as "no card on record — offer to send one." Amount comes from the record, not
 * a hard-coded $25, since some customers get a larger card.
 */
export async function lookupGiftCardForConfirmation(
  rawEmail: string | null | undefined,
): Promise<GiftCardConfirmSummary | null> {
  const email = (rawEmail ?? '').trim();
  if (!email) return null;

  const gc = await prisma.giftCardRequest.findFirst({
    where: {
      customerEmail: { equals: email, mode: 'insensitive' },
      status: { in: ['PENDING', 'SENT'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      amount: true,
      customerEmail: true,
      sentAt: true,
      receivedAt: true,
      important: true,
      sentBy: { select: { name: true } },
    },
  });
  if (!gc) return null;

  return {
    id: gc.id,
    status: gc.status as 'PENDING' | 'SENT',
    amount: Number(gc.amount),
    email: gc.customerEmail,
    sentAt: gc.sentAt ? gc.sentAt.toISOString() : null,
    sentByName: gc.sentBy?.name ?? null,
    receivedAt: gc.receivedAt ? gc.receivedAt.toISOString() : null,
    important: gc.important,
  };
}
