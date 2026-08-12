import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { DealerCalculator } from '@/components/DealerCalculator';

export const dynamic = 'force-dynamic';

export default async function DealerCalculatorPage() {
  const user = await requireDealerAccess();
  if (!(await hasCalculatorAccess(user))) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Payout calculator</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter the approved amount (total sale with tax) and the province to estimate the dealer payout.
        </p>
      </div>
      <DealerCalculator />
    </div>
  );
}
