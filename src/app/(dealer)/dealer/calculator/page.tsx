import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { prisma } from '@/lib/db';
import { DealerCalculator } from '@/components/DealerCalculator';
import { SectionHero } from '@/components/SectionHero';

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
      <SectionHero
        eyebrow="Tools"
        title="HD Payout Calculator"
        subtitle="Enter the approved amount (total sale with tax) and province — or pull a deal from the portal."
      />
      <DealerCalculator defaultProvince={defaultProvince} />
    </div>
  );
}
