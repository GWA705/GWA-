import { notFound } from 'next/navigation';
import { SectionHero } from '@/components/SectionHero';
import { requireRole } from '@/lib/session';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { CustomerSearch } from '@/components/CustomerSearch';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function StaffFindCustomerPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled())) notFound();
  if (!(await canSearchAllCustomers(user))) notFound();
  const t = getT();

  return (
    <div className="max-w-2xl space-y-4">
      <SectionHero
        eyebrow={t('staffReports.fcEyebrow')}
        title={t('staffReports.fcTitle')}
        subtitle={t('staffReports.fcSubtitle')}
      />
      <CustomerSearch mode="internal" placeholder={t('staffReports.fcPlaceholder')} />
      <p className="text-xs text-gray-400">{t('staffReports.searchesLogged')}</p>
    </div>
  );
}
