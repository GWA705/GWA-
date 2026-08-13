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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-2xl">💵</div>
        <h1 className="text-2xl font-bold text-gray-900">Payout calculator</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
          Enter the approved amount (total sale with tax) and province — or pull a deal from the portal — to see the
          exact EFT payout and full breakdown.
        </p>
      </div>
      <DealerCalculator defaultProvince={defaultProvince} />
    </div>
  );
}
