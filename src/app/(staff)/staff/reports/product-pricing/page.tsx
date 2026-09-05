import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/session';
import { canViewDealerSnapshot } from '@/lib/reporting/access';
import { listReportOffices } from '@/lib/reporting/monthly';
import { productPricing } from '@/lib/reporting/productPricing';
import { SectionHero } from '@/components/SectionHero';
import { ProductPricingReport } from '@/components/reporting/ProductPricingReport';

export const dynamic = 'force-dynamic';

export default async function StaffProductPricingReport({ searchParams }: { searchParams: { office?: string } }) {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await canViewDealerSnapshot(user))) notFound();

  const offices = await listReportOffices();
  const officeId = (searchParams.office ?? '').trim();
  const office = offices.find((o) => o.dealerId === officeId) || null;

  const data = await productPricing({ dealerIds: office ? [office.dealerId] : undefined });
  const scopeLabel = office ? office.name : 'All offices';

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Insights"
        title="Product & package pricing"
        subtitle="Average sale price per product, and per package (products sold together), across your offices."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="office">Office</label>
            <select id="office" name="office" defaultValue={officeId} className="input min-w-[220px]">
              <option value="">All offices</option>
              {offices.map((o) => (
                <option key={o.dealerId} value={o.dealerId}>{o.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">View</button>
        </form>
        <Link href="/staff/reports" className="text-sm text-gray-500 hover:underline">← All reports</Link>
      </div>

      <ProductPricingReport data={data} scopeLabel={scopeLabel} />
    </div>
  );
}
