import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireDirectSaleAccess } from '@/lib/directSaleAccess';

export const dynamic = 'force-dynamic';

const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const fmtMoney = (a: unknown) => (a == null ? '—' : `$${Number(a).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export default async function DirectSalesPage() {
  const user = await requireDirectSaleAccess();
  const internal = user.role === 'REVIEWER' || user.role === 'ADMIN';

  // Internal staff see every office's direct sales; a granted store user sees
  // only their own office's.
  const where = internal ? { entryMethod: 'DIRECT' as const } : { entryMethod: 'DIRECT' as const, dealerId: user.dealerId ?? '__none__' };
  const sales = await prisma.application.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, applicantFirstName: true, applicantLastName: true,
      requestedAmount: true, dateOfSale: true, journalSyncedAt: true,
      dealer: { select: { name: true } },
    },
  });

  const dealHref = (id: string) => (internal ? `/staff/applications/${id}` : `/dealer/applications/${id}`);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">🧾 Direct sales</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">
            Georgian Water &amp; Air in-store walk-in sales, entered and completed to Funded + Paid.
          </p>
        </div>
        <Link href="/direct-sale/new" className="btn-primary">＋ New direct sale</Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Customer</th>
                {internal && <th className="px-4 py-3">Office</th>}
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Sale date</th>
                <th className="px-4 py-3">Journal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {sales.length === 0 ? (
                <tr><td colSpan={internal ? 5 : 4} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">No direct sales yet. Use <strong>New direct sale</strong> to enter one.</td></tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <Link href={dealHref(s.id)} className="font-semibold text-brand-700 hover:underline dark:text-sky-300">
                        {s.applicantFirstName} {s.applicantLastName}
                      </Link>
                    </td>
                    {internal && <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{s.dealer?.name ?? '—'}</td>}
                    <td className="px-4 py-3 tabular-nums text-gray-800 dark:text-slate-200">{fmtMoney(s.requestedAmount)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{fmtDay(s.dateOfSale)}</td>
                    <td className="px-4 py-3 text-xs">
                      {s.journalSyncedAt
                        ? <span className="font-semibold text-green-600">✓ written</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
