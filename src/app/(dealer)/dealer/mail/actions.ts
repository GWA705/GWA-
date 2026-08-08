'use server';

import { revalidatePath } from 'next/cache';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';
import { audit } from '@/lib/audit';
import { notifyMailReply } from '@/lib/notify';

export interface MailReplyState {
  error?: string;
}

/**
 * A dealer user replies to a piece of mail (only when it allows replies and is
 * addressed to their dealer). The reply is filed under their dealer's thread.
 */
export async function postDealerMailReplyAction(
  mailId: string,
  _prev: MailReplyState,
  formData: FormData,
): Promise<MailReplyState> {
  const session = await requireDealerAccess();
  if (!session.dealerId) return { error: 'No dealer on your account.' };

  const body = (formData.get('body') ?? '').toString().trim();
  if (!body) return { error: 'Write a reply first.' };
  if (body.length > 5000) return { error: 'Reply is too long (max 5000 characters).' };

  // The mail must be visible to this dealer AND open for replies.
  const mail = await prisma.mail.findFirst({
    where: { id: mailId, allowReplies: true, ...mailWhereForDealer(session.userId, session.dealerId, session.isDistributor) },
    select: { id: true },
  });
  if (!mail) return { error: 'This message is not open for replies.' };

  await prisma.mailReply.create({
    data: { mailId, dealerId: session.dealerId, authorId: session.userId, fromStaff: false, body },
  });

  await audit({ actorId: session.userId, action: 'MAIL_REPLY', entityType: 'Mail', entityId: mailId, detail: 'dealer reply' });
  await notifyMailReply(mailId, session.dealerId, false);

  revalidatePath(`/dealer/mail/${mailId}`);
  return {};
}

/** A dealer user confirms they've read a piece of mail (when it requires it). */
export async function acknowledgeMailAction(mailId: string) {
  const session = await requireDealerAccess();
  if (!session.dealerId) return;

  // The mail must be visible to this dealer.
  const mail = await prisma.mail.findFirst({
    where: { id: mailId, ...mailWhereForDealer(session.userId, session.dealerId, session.isDistributor) },
    select: { id: true },
  });
  if (!mail) return;

  await prisma.mailReceipt.upsert({
    where: { mailId_userId: { mailId, userId: session.userId } },
    create: { mailId, userId: session.userId, acknowledgedAt: new Date() },
    update: { acknowledgedAt: new Date() },
  });

  await audit({
    actorId: session.userId,
    action: 'MAIL_ACK',
    entityType: 'Mail',
    entityId: mailId,
  });

  revalidatePath(`/dealer/mail/${mailId}`);
  revalidatePath('/dealer/mail');
}
