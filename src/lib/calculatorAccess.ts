import 'server-only';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/session';

/**
 * Can this user open the dealer payout calculator?
 * - Internal staff (reviewer/admin) always can.
 * - A dealer user can if their own flag (User.canUseCalculator) OR their
 *   dealership's flag (Dealer.calculatorEnabled) is on.
 */
export async function hasCalculatorAccess(user: SessionUser): Promise<boolean> {
  if (user.role === 'REVIEWER' || user.role === 'ADMIN') return true;
  if (user.role !== 'DEALER_USER') return false;

  const me = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      canUseCalculator: true,
      dealer: { select: { calculatorEnabled: true } },
    },
  });
  return !!(me?.canUseCalculator || me?.dealer?.calculatorEnabled);
}
