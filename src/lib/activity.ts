import { prisma } from './db';

export type DealerActionKind = 'SUBMITTED' | 'DOCUMENT' | 'NOTE' | 'FUNDING';

/**
 * Record that the dealer just did something on a deal (submit, upload, note,
 * funding). This puts the ball in the reviewer's court — the deal shows under
 * "Attention needed" until a reviewer acts. Best-effort; never throws.
 */
export async function markDealerAction(applicationId: string, kind: DealerActionKind): Promise<void> {
  try {
    await prisma.application.update({
      where: { id: applicationId },
      data: { lastDealerActionAt: new Date(), lastDealerActionKind: kind },
    });
  } catch (e) {
    console.error('[activity] markDealerAction failed', e);
  }
}

/** Record that a reviewer/admin acted on a deal — moves it out of "Attention needed". */
export async function markReviewerAction(applicationId: string): Promise<void> {
  try {
    await prisma.application.update({
      where: { id: applicationId },
      data: { lastReviewerActionAt: new Date() },
    });
  } catch (e) {
    console.error('[activity] markReviewerAction failed', e);
  }
}
