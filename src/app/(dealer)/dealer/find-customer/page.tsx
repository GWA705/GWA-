import { notFound } from 'next/navigation';
import { requireDealerAccess } from '@/lib/session';
import { prisma } from '@/lib/db';
import { isGlobalSearchEnabled } from '@/lib/settings';
import { canSearchAllCustomers } from '@/lib/customerSearch';
import { CustomerSearch } from '@/components/CustomerSearch';
import { FindCustomerPanel } from '@/components/FindCustomerPanel';
import { SectionHero } from '@/components/SectionHero';

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

  // Dealers get the focused, mode-toggle search (Option A). The GWA team keeps
  // the all-offices live-typeahead hero.
  if (!canAll) {
    return (
      <div className="mx-auto max-w-2xl">
        <FindCustomerPanel companyName={companyName} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHero
        eyebrow="Tools"
        title="Search all customers"
        subtitle="Look up any customer across every office by name, phone, or reference number."
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <CustomerSearch mode="internal" placeholder="Search any customer by name, phone, or reference #" large />
      </section>

      <p className="text-xs text-gray-400">Searches are logged. You can see full details for every office.</p>
    </div>
  );
}
