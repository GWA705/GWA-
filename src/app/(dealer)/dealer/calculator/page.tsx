import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { prisma } from '@/lib/db';
import { DealerCalculator } from '@/components/DealerCalculator';

export const dynamic = 'force-dynamic';

export default async function DealerCalculatorPage() {
  const user = await requireDealerAccess();
  if (!(await hasCalculatorAccess(user))) notFound();

  // Default the province to where this dealer operates (their most recent deal),
  // so the tax rate is right without them setting it every time.
  const latest = user.dealerId
    ? await prisma.application.findFirst({
        where: { dealerId: user.dealerId },
        orderBy: { createdAt: 'desc' },
        select: { province: true },
      })
    : null;
  const defaultProvince = latest?.province ?? 'ON';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Payout calculator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter the approved amount (total sale with tax) and the province to estimate the dealer payout.
        </p>
      </div>
      <DealerCalculator defaultProvince={defaultProvince} />
    </div>
  );
}
