import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/**
 * Lead & program fees Home Depot withheld, across all remittances — so the
 * office can see and track what HD deducted (and reconcile it monthly).
 */
export default async function RemittanceFeesPage() {
  await requireStaffSection('remittances');
  const lines = await prisma.hdRemittanceLine.findMany({
    where: { status: 'DEDUCTION' },
    orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
    include: { remittance: { select: { documentNumber: true, paymentDate: true } } },
  });

  const total = lines.reduce((s, l) => s + Math.abs(Number(l.amount)), 0);

  // Group totals by month of the fee's invoice date.
  const byMonth = new Map<string, number>();
  for (const l of lines) {
    const d = l.invoiceDate ? new Date(l.invoiceDate) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'Undated';
    byMonth.set(key, (byMonth.get(key) ?? 0) + Math.abs(Number(l.amount)));
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/staff/remittances" className="text-sm text-gray-500 hover:underline">← All remittances</Link>
        <h1 className="text-xl font-semibold text-gray-900">Lead &amp; program fees</h1>
        <Link href="/staff/remittances/chargebacks" className="ml-auto text-sm font-medium text-brand-700 hover:underline">Chargebacks →</Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-purple-50 px-3 py-2 text-purple-700"><span className="font-bold">{lines.length}</span> fees</span>
        <span className="rounded-lg bg-gray-900 px-3 py-2 font-bold text-white">{money(total)} total withheld</span>
      </div>

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remittance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No fees recorded yet.</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-gray-600">{fmt(l.invoiceDate)}</td>
                  <td className="px-4 py-3 text-gray-800">{l.customerName || l.hdIdNumber}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">{money(-Math.abs(Number(l.amount)))}</td>
                  <td className="px-4 py-3 text-gray-600">{l.remittance?.documentNumber ?? '—'}<span className="ml-1 text-xs text-gray-400">{fmt(l.remittance?.paymentDate ?? null)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {byMonth.size > 0 && (
        <section className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">By month</div>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([m, amt]) => (
                <tr key={m}>
                  <td className="px-4 py-2 text-gray-700">{m}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{money(amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
