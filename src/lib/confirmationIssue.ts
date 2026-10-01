import { prisma } from '@/lib/db';

export interface ConfirmationIssue {
  mailId: string;
  /** The issue text the confirmer wrote. */
  body: string;
  flaggedAt: Date;
  /** The office has confirmed they've read it. */
  acknowledged: boolean;
  ackByName: string | null;
  ackAt: Date | null;
}

/**
 * Load the flagged confirmation issue for a deal's top banner, from the Mail that
 * `flagDealerIssueAction` created (its id is stored on Application). Returns the
 * issue text and whether anyone at the office has acknowledged it yet. Returns
 * null when no issue was flagged, or the mail no longer exists.
 */
export async function loadConfirmationIssue(mailId: string | null | undefined): Promise<ConfirmationIssue | null> {
  if (!mailId) return null;
  const mail = await prisma.mail.findUnique({
    where: { id: mailId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      // Earliest office user who acknowledged (one is enough to clear "awaiting").
      receipts: {
        where: { acknowledgedAt: { not: null } },
        orderBy: { acknowledgedAt: 'asc' },
        take: 1,
        select: { acknowledgedAt: true, user: { select: { name: true } } },
      },
    },
  });
  if (!mail) return null;
  const ack = mail.receipts[0] ?? null;
  return {
    mailId: mail.id,
    body: mail.body,
    flaggedAt: mail.createdAt,
    acknowledged: !!ack?.acknowledgedAt,
    ackByName: ack?.user?.name ?? null,
    ackAt: ack?.acknowledgedAt ?? null,
  };
}
