import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { CustomerSearch } from '@/components/CustomerSearch';

export const dynamic = 'force-dynamic';

export default async function DealerFindCustomerPage() {
  await requireDealerAccess();
  if (!(await isGlobalSearchEnabled())) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Find a customer</h1>
        <p className="mt-1 text-sm text-gray-600">
          Search your own customers by name or phone. To find which office a customer belongs to when they aren&apos;t
          yours, enter their <strong>exact phone number</strong> — it will show the office to contact.
        </p>
      </div>
      <CustomerSearch mode="dealer" />
      <p className="text-xs text-gray-400">
        Searches are logged. Only your own office&apos;s customers show full details — other offices show contact info only.
      </p>
    </div>
  );
}
