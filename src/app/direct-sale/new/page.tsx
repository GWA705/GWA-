import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDirectSaleAccess } from '@/lib/directSaleAccess';
import { productChecklistOptions } from '@/lib/products';
import { DirectSaleForm } from '../DirectSaleForm';

export const dynamic = 'force-dynamic';

export default async function NewDirectSalePage() {
  const user = await requireDirectSaleAccess();
  const internal = user.role === 'REVIEWER' || user.role === 'ADMIN';

  // Internal staff choose the office; a granted store user is locked to theirs.
  const offices = internal
    ? await prisma.dealer.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
    : [];
  const fixedOffice = !internal && user.dealerId
    ? await prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { id: true, name: true } })
    : null;

  const [products, financeCompanies] = await Promise.all([
    productChecklistOptions(internal ? null : user.dealerId),
    prisma.financeCompany.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link href="/direct-sale" className="text-sm text-gray-500 hover:underline">← Back to direct sales</Link>
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">New direct sale</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
          A Georgian Water &amp; Air in-store walk-in sale. Enter the sale, attach the bill of sale and mark how it was
          paid, and it completes straight to Funded + Paid — no docs round-trip.
        </p>
      </div>
      <DirectSaleForm offices={offices} fixedOffice={fixedOffice} products={products} financeCompanies={financeCompanies} />
    </div>
  );
}
