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
        <p className="mt-1 text-sm text-gray-600">Search your customers by name or phone number.</p>
      </div>

      {/* Two ways to use this search, spelled out. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔎</span>
            <h2 className="text-sm font-semibold text-gray-900">Your customers</h2>
          </div>
          <p className="mt-1.5 text-sm text-gray-600">
            Search by <strong>name or phone number</strong> to pull up your own deals.
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📞</span>
            <h2 className="text-sm font-semibold text-sky-900">Whose customer is this?</h2>
          </div>
          <p className="mt-1.5 text-sm text-sky-800">
            Find which dealer is already working with a customer. Enter their <strong>exact phone number</strong> — the
            dealer&apos;s location and contact will appear so you can reach out.
          </p>
        </div>
      </div>

      <CustomerSearch mode="dealer" />
      <p className="text-xs text-gray-400">
        Searches are logged. Only your own office&apos;s customers show full details — other offices show contact info only.
      </p>
    </div>
  );
}
