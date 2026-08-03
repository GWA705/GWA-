'use server';

import { revalidatePath } from 'next/cache';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { mailWhereForDealer } from '@/lib/inbox';
import { audit } from '@/lib/audit';

/** A dealer user confirms they've read a piece of mail (when it requires it). */
export async function acknowledgeMailAction(mailId: string) {
  const session = await requireDealerAccess();
  if (!session.dealerId) return;

  // The mail must be visible to this dealer.
  const mail = await prisma.mail.findFirst({
    where: { id: mailId, ...mailWhereForDealer(session.dealerId) },
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
