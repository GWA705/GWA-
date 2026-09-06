import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewDealerSnapshot } from '@/lib/reporting/access';
import { listReportOffices } from '@/lib/reporting/monthly';
import { productPricing } from '@/lib/reporting/productPricing';
import { SectionHero } from '@/components/SectionHero';
import { ProductPricingReport } from '@/components/reporting/ProductPricingReport';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StaffProductPricingReport({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewDealerSnapshot(user))) notFound();

  const t = getT();
  const offices = await listReportOffices();
  const officeId = (searchParams.office ?? '').trim();
  const office = offices.find((o) => o.dealerId === officeId) || null;

  const data = await productPricing({ dealerIds: office ? [office.dealerId] : undefined });
  const scopeLabel = office ? office.name : t('staffReports.allOffices');

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow={t('staffReports.eyebrow')}
        title={t('staffReports.ppTitle')}
        subtitle={t('staffReports.ppSubtitle')}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="office">{t('staffReports.office')}</label>
            <select id="office" name="office" defaultValue={officeId} className="input min-w-[220px]">
              <option value="">{t('staffReports.allOffices')}</option>
              {offices.map((o) => (
                <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">{t('reports.view')}</button>
        </form>
        <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">{t('staffReports.backAllReports')}</Link>
      </div>

      <ProductPricingReport data={data} scopeLabel={scopeLabel} />
    </div>
  );
}
