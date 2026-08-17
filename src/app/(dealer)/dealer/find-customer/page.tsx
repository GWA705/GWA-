import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { CustomerSearch } from '@/components/CustomerSearch';

export const dynamic = 'force-dynamic';

export default async function DealerFindCustomerPage() {
  const user = await requireDealerAccess();
  if (!(await isGlobalSearchEnabled())) notFound();

  // Full cross-office search for those authorized for it (GWA's own team); every
  // other office searches their own customers, with the office name in the copy
  // so it feels like their space.
  const canAll = await canSearchAllCustomers(user);
  const dealer = user.dealerId
    ? await prisma.dealer.findUnique({
        where: { id: user.dealerId },
        select: { name: true, profile: { select: { businessName: true } } },
      })
    : null;
  const companyName = dealer?.profile?.businessName || dealer?.name || 'your office';

  const heading = canAll ? 'Search all customers' : `Search ${companyName} customers`;
  const placeholder = canAll ? 'Search any customer by name, phone, or reference #' : 'Customer name or phone number';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Welcoming focal-point search area */}
      <section className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-6 shadow-sm dark:bg-none dark:bg-[var(--d-surface)] sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-600 text-2xl text-white shadow-sm">
            🔎
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{heading}</h1>
            <p className="mt-0.5 text-sm text-gray-600">
              {canAll
                ? 'Look up any customer across every office by name, phone, or reference number.'
                : <>Pull up your deals by <strong>name or phone number</strong>. Welcome back — let’s find who you’re looking for.</>}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <CustomerSearch mode={canAll ? 'internal' : 'dealer'} placeholder={placeholder} large />
        </div>
      </section>

      {/* How to use it — two ways (only meaningful for the office-scoped search). */}
      {!canAll && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔎</span>
              <h2 className="text-sm font-semibold text-gray-900">{companyName} customers</h2>
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
      )}

      <p className="text-xs text-gray-400">
        Searches are logged.{' '}
        {canAll
          ? 'You can see full details for every office.'
          : 'Only your own office’s customers show full details — other offices show contact info only.'}
      </p>
    </div>
  );
}
