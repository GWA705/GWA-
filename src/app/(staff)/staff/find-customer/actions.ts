'use server';

import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { notifyNewNote } from '@/lib/notify';
import { findCardData, CARD_BLOCK_MESSAGE } from '@/lib/cardscan';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';

export interface MsgState {
  ok?: boolean;
  error?: string;
}

/**
 * A GWA agent leaves a message for the customer's office after a call — stored as
 * a dealer-visible note on the deal, which notifies the office (email + in-portal)
 * that the customer called and what about.
 */
export async function messageOfficeAction(applicationId: string, _prev: MsgState, formData: FormData): Promise<MsgState> {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled()) || !(await canSearchAllCustomers(user))) return { error: 'You don’t have access to do this.' };

  const message = String(formData.get('message') || '').trim();
  if (message.length < 2) return { error: 'Write a message for the office.' };

  const card = findCardData(message);
  if (card.blocked) {
    await audit({ actorId: user.userId, action: 'CARD_DATA_BLOCKED', entityType: 'Application', entityId: applicationId, detail: 'Office message blocked — card data detected' });
    return { error: CARD_BLOCK_MESSAGE };
  }

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!app) return { error: 'Customer not found.' };

  await prisma.note.create({
    data: { applicationId, authorId: user.userId, body: `📞 Customer called GWA — ${message}`, internal: false },
  });
  await notifyNewNote(applicationId, 'REVIEWER');
  await audit({ actorId: user.userId, action: 'CUSTOMER_SEARCH', entityType: 'Application', entityId: applicationId, detail: 'messaged office about a customer call' });
  return { ok: true };
}
