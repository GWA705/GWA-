import 'server-only';
import { prisma } from '@/lib/db';

/**
 * A cheap "is there outstanding confirmation work?" signal for the staff nav
 * badge. The exact, fully-computed worklist lives on /staff/confirmations (it
 * weighs document state per deal to decide eligibility precisely); this only has
 * to light a dot, so it uses a single indexed count that catches the clear-cut
 * cases without loading each deal's documents:
 *   - any flagged confirmation ISSUE (the follow-up items), and
 *   - a still-PENDING call on a deal that's plainly past the signed-docs stage
 *     (reviewing docs / in for funding / funded).
 *
 * It can undercount (a PENDING deal sitting in APPROVED/DOCS_SENT whose package
 * just came back isn't included), which is fine for a presence dot — the page
 * shows the true number.
 */
export async function hasOutstandingConfirmations(): Promise<boolean> {
  const n = await prisma.application.count({
    where: {
      OR: [
        { confirmationStatus: 'ISSUE' },
        { confirmationStatus: 'PENDING', status: { in: ['FUNDING_SUBMITTED', 'FUNDING_REVIEW', 'FUNDED'] } },
      ],
    },
  });
  return n > 0;
}
