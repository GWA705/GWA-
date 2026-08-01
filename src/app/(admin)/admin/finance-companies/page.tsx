import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/db';
import { FinanceCompanyForm } from './FinanceCompanyForm';
import { FinanceCompanyRowActions } from './FinanceCompanyRowActions';

export const dynamic = 'force-dynamic';

export default async function FinanceCompaniesPage() {
  await requireRole('ADMIN');
  const companies = await prisma.financeCompany.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { applications: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Finance companies</h1>
      <div className="card p-6">
        <FinanceCompanyForm />
      </div>
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Deals</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companies.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No finance companies yet.</td></tr>
            ) : (
              companies.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">
                    {c.name}
                    {c.requiresSerialPerProduct && (
                      <span className="ml-2 badge bg-purple-100 text-purple-800">Serials required</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c._count.applications}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FinanceCompanyRowActions
                      id={c.id}
                      name={c.name}
                      active={c.active}
                      requiresSerial={c.requiresSerialPerProduct}
                      canDelete={c._count.applications === 0}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
