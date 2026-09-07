import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { hasCalculatorAccess } from '@/lib/calculatorAccess';
import { prisma } from '@/lib/db';
import { DealerCalculator } from '@/components/DealerCalculator';
import { SectionHero } from '@/components/SectionHero';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function DealerCalculatorPage() {
  const t = getT();
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
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHero
        eyebrow={t('calculator.heroEyebrow')}
        title={t('calculator.heroTitle')}
        subtitle={t('calculator.heroSubtitle')}
        bgImage="/calculator-hero.webp"
      />
      <DealerCalculator defaultProvince={defaultProvince} />
    </div>
  );
}
