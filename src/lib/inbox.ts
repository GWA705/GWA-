import type { ContentSection } from '@prisma/client';
import { prisma } from './db';

// Mail is visible to a dealer user when:
//  • it was addressed to them specifically (a user recipient) — always, or
//  • it went to all dealers / their dealer AND, if it's "distributors only",
//    they're a distributor (owner / main contact) for that dealer.
export function mailWhereForDealer(userId: string, dealerId: string, isDistributor: boolean) {
  return {
    OR: [
      { userRecipients: { some: { userId } } },
      {
        AND: [
          { OR: [{ allDealers: true }, { recipients: { some: { dealerId } } }] },
          // Non-distributors never see distributor-only mail.
          ...(isDistributor ? [] : [{ distributorsOnly: false }]),
        ],
      },
    ],
  };
}

/** Count of mail this user hasn't opened yet (drives the Mail nav dot). */
export async function unreadMailCountForUser(userId: string, dealerId: string, isDistributor: boolean): Promise<number> {
  const where = mailWhereForDealer(userId, dealerId, isDistributor);
  const [total, opened] = await Promise.all([
    prisma.mail.count({ where }),
    prisma.mailReceipt.count({ where: { userId, mail: where } }),
  ]);
  return Math.max(0, total - opened);
}

const CONTENT_SECTIONS: ContentSection[] = ['RESOURCE', 'HD_PROMOTION', 'HD_CREDIT_CARD'];

/**
 * Which dealer content sections have something new for this user — i.e. active
 * content added or updated since they last viewed that section (or never
 * viewed). Drives the "new" dot on the Resources / HD Promotions / HD Credit
 * Card tabs.
 */
export async function newContentSectionsForUser(userId: string): Promise<Set<ContentSection>> {
  const [latest, reads] = await Promise.all([
    prisma.contentItem.groupBy({
      by: ['section'],
      where: { active: true },
      _max: { updatedAt: true },
    }),
    prisma.contentSectionRead.findMany({ where: { userId }, select: { section: true, viewedAt: true } }),
  ]);
  const readAt = new Map(reads.map((r) => [r.section, r.viewedAt]));
  const fresh = new Set<ContentSection>();
  for (const section of CONTENT_SECTIONS) {
    const newest = latest.find((l) => l.section === section)?._max.updatedAt;
    if (!newest) continue;
    const seen = readAt.get(section);
    if (!seen || seen < newest) fresh.add(section);
  }
  return fresh;
}

/** Mark a content section as viewed now for this user (clears its "new" dot). */
export async function markContentSectionViewed(userId: string, section: ContentSection): Promise<void> {
  await prisma.contentSectionRead.upsert({
    where: { userId_section: { userId, section } },
    create: { userId, section },
    update: { viewedAt: new Date() },
  });
}
