import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDirectSaleAccess } from '@/lib/directSaleAccess';
import { productChecklistOptions } from '@/lib/products';
import { DirectSaleForm } from '../DirectSaleForm';

export const dynamic = 'force-dynamic';

export default async function NewDirectSalePage() {
  const user = await requireDirectSaleAccess();
  const internal = (user.role === 'REVIEWER' || user.role === 'ADMIN') && !user.impersonating;

  // Internal staff choose the office; a granted store user is locked to theirs.
  const offices = internal
    ? await prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
    : [];
  const fixedOffice = !internal && user.dealerId
    ? await prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { id: true, name: true } })
    : null;
  // Georgian Water & Air is the only office that enters direct sales, so default
  // the picker to it (still changeable). Match on the office name.
  const defaultDealerId = offices.find((o) => /georgian water/i.test(o.name))?.id;

  // HD stores for the store picker (shown on HD-program direct sales). Internal
  // staff can pick any office, so pass every active store (the form filters to
  // the chosen office by dealerId); a locked grantee gets only their office's.
  const [products, financeCompanies, stores] = await Promise.all([
    productChecklistOptions(internal ? null : user.dealerId),
    prisma.financeCompany.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.homeDepotStore.findMany({
      where: { active: true, ...(internal ? { dealer: { active: true } } : { dealerId: user.dealerId ?? '__none__' }) },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, name: true, dealerId: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link href="/direct-sale" className="text-sm text-gray-500 hover:underline">← Back to direct sales</Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">New direct sale</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
          A Georgian Water &amp; Air in-store walk-in sale. Enter the sale, attach the bill of sale and mark how it was
          paid — it goes straight to <strong>In funding</strong> (skipping the application/docs round-trip). Mark it
          funded on the deal when it&apos;s funded; it turns Paid when the journal updates.
        </p>
      </div>
      <DirectSaleForm offices={offices} fixedOffice={fixedOffice} defaultDealerId={defaultDealerId} products={products} financeCompanies={financeCompanies} stores={stores} />
    </div>
  );
}
