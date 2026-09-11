import Link from 'next/link';
import { requireStaffSection } from '@/lib/session';
import { prisma } from '@/lib/db';
import { ManualRemittanceForm } from './ManualRemittanceForm';
import { UploadRemittanceForm } from './UploadRemittanceForm';

export const dynamic = 'force-dynamic';

const money = (n: number) => `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default async function RemittancesPage() {
  await requireStaffSection('remittances');

  const remittances = await prisma.hdRemittance.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { lines: true } } },
  });

  // Outstanding attention: unmatched lines across all remittances.
  const unmatchedCount = await prisma.hdRemittanceLine.count({ where: { status: 'UNMATCHED' } });

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Home Depot remittances</h1>
        <p className="mt-1 text-sm text-gray-500">
          When Home Depot pays, each invoice on the remittance is matched to a deal by its HD #, and matched deals are
          marked <strong>Funded</strong> automatically. Dollar figures here are internal — dealers never see them.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-gray-900">Automatic (Mon/Wed/Fri)</h2>
        <p className="text-sm text-gray-500">
          Your Google remittance processor can POST straight into the portal:
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">POST /api/hd-remittance/ingest</code>
          with <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Authorization: Bearer $CRON_SECRET</code>. See the
          go-live checklist for the exact payload.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Upload the HD remittance PDF</h2>
        <UploadRemittanceForm />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Enter a remittance manually</h2>
        <ManualRemittanceForm />
      </section>

      {unmatchedCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ {unmatchedCount} remittance line{unmatchedCount === 1 ? '' : 's'} could not be matched to a deal — open a remittance to review.
        </div>
      )}

      <section className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Doc #</th>
              <th className="px-4 py-3">Payment date</th>
              <th className="px-4 py-3">Net total</th>
              <th className="px-4 py-3">Lines</th>
              <th className="px-4 py-3">Funded</th>
              <th className="px-4 py-3">Chargebacks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {remittances.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{fmt(r.createdAt)}<div className="text-xs text-gray-400">{r.source === 'MANUAL' ? 'manual' : 'auto'}</div></td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.documentNumber ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{fmt(r.paymentDate)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{r.totalNet != null ? money(Number(r.totalNet)) : '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r._count.lines}</td>
                <td className="px-4 py-3 text-green-700">{r.matchedCount}</td>
                <td className="px-4 py-3 text-red-700">{r.chargebackCount || '—'}</td>
                <td className="px-4 py-3"><Link href={`/staff/remittances/${r.id}`} className="text-sm font-medium text-brand-700 hover:underline">View</Link></td>
              </tr>
            ))}
            {remittances.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No remittances yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
