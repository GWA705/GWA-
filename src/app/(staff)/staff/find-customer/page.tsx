import { notFound } from 'next/navigation';
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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Find a customer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Search every customer across all offices by name, phone, or reference number — for when a customer calls GWA
          directly. Opens their deal.
        </p>
      </div>
      <CustomerSearch mode="internal" />
      <p className="text-xs text-gray-400">Searches are logged.</p>
    </div>
  );
}
