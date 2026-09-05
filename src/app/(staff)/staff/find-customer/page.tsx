import { notFound } from 'next/navigation';
import { SectionHero } from '@/components/SectionHero';
import { requireRole } from '@/lib/session';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { CustomerSearch } from '@/components/CustomerSearch';

export const dynamic = 'force-dynamic';

export default async function StaffFindCustomerPage() {
  const user = await requireRole('REVIEWER', 'ADMIN');
  if (!(await isGlobalSearchEnabled())) notFound();
  if (!(await canSearchAllCustomers(user))) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <SectionHero
        eyebrow="Tools"
        title="Find a customer"
        subtitle="Search every customer across all offices by name, phone, or reference number — for when a customer calls Georgian Water & Air directly. Opens their deal."
      />
      <CustomerSearch mode="internal" />
      <p className="text-xs text-gray-400">Searches are logged.</p>
    </div>
  );
}
